# Ponto eletrônico — reconhecimento facial (UniFace) + fluxo offline

**Data:** 2026-10-02  
**Status:** Proposta (aguardando revisão)  
**Módulo:** 07 — Ponto eletrônico

## 1. Contexto e objetivo

Hoje o check-in já exige foto (ou motivo de "sem foto") e já grava o arquivo (`registros_ponto.foto_checkin_caminho`), com trava de geolocalização por raio (`config_ponto_eletronico`). Porém **não há comparação facial**: qualquer pessoa pode aparecer na foto.

Objetivo: verificar que quem bate o ponto é o profissional cadastrado, sem bloquear a operação na fase inicial, e permitir bater ponto sem internet com sincronização posterior.

## 2. Decisões de produto (definidas com o usuário)

| Tema | Decisão |
|---|---|
| Foto de referência | Selfie guiada no app: no cadastro público e, para quem já existe, no primeiro ponto. **Master aprova** a biometria. |
| Rosto não confere | **Registra o ponto** e marca **divergência facial** para revisão do Master (não bloqueia). |
| Anti-spoofing | **Sim na v1** (MiniFASNet). Suspeita de foto/tela = divergência. |
| Offline | Foto + GPS + horário guardados no aparelho e sincronizados depois; ponto entra como **offline — pendente de validação**. |
| Retenção | Fotos de check-in apagadas após **90 dias**, exceto as com divergência. |

## 3. Arquitetura

```
App (web/Capacitor)  ──HTTPS──>  backend Node (Express/Prisma)  ──HTTP interno──>  face-service (Python/FastAPI + UniFace)
     │  IndexedDB (fila offline)          │  Postgres (embeddings, status)                │  stateless, sem banco
     │                                    │  BullMQ/Redis (fila face-verify)              │  modelos ONNX embutidos na imagem
```

- **face-service** é um microserviço novo, **stateless**: recebe imagem (+ embedding de referência) e devolve números. Não guarda fotos nem embeddings.
- **backend** continua dono das regras: guarda embedding de referência, decide status, aplica retenção, expõe telas.
- Verificação do check-in é **assíncrona** (fila BullMQ `face-verify`, concorrência 1): o check-in responde na hora (não depende do Python) e a CPU da VPS fica protegida contra picos. O cadastro da biometria é **síncrono** (o usuário precisa saber na hora se a selfie serviu).

### 3.1 face-service (Python)

- Base: `python:3.11-slim`, `uniface[cpu]` (traz `onnxruntime` CPU — **nunca** `onnxruntime-gpu`), `opencv-python-headless`, `fastapi`, `uvicorn` (1 worker).
- Modelos (todos leves e com licença comercial permissiva):
  - Detecção: **RetinaFace MobileNet** (MIT, yakhyo). Alternativa medida em benchmark: SCRFD_500M.
  - Reconhecimento: **MobileFace MNET_V2** (4 MB, MIT). Alternativa se a precisão em campo for baixa: ArcFace MNET (8 MB).
  - Liveness: **MiniFASNet V2 + V1SE em conjunto** (média dos scores; Apache-2.0). Um modelo só era ruidoso demais (Fase 0).
  - ⚠️ Pesos de origem InsightFace (SCRFD/ArcFace) são marcados como MIT no UniFace, mas o model zoo original da InsightFace restringe uso comercial — por isso a preferência pelos modelos yakhyo. Revisar antes de trocar.
- Pesos **baixados no build** da imagem (não em runtime) e verificados por SHA-256.
- Pré-processamento: corrige orientação EXIF, redimensiona o maior lado para 640 px antes da detecção.
- Threads: `OMP_NUM_THREADS=1`, ONNX `intra_op_num_threads=1`, `inter_op_num_threads=1`.
- Endpoints (header `X-Face-Token` com segredo compartilhado; rede só interna, sem porta publicada):
  - `POST /v1/enroll` — multipart `image` → `{ faces, bbox, detScore, embedding[512], liveness: {real, score}, quality: {blur, brightness, faceRatio}, ok, motivo? }`
  - `POST /v1/verify` — multipart `image` + `reference` (JSON float[512]) → `{ faces, similarity, liveness: {real, score}, ok, motivo? }`
  - `GET /health` — modelos carregados.
- Limites no compose: `cpus: "1.0"`, `memory: 768M`, `pids: 64`, `read_only: true` + `tmpfs /tmp`, `restart: unless-stopped`, healthcheck. Upload máx. 5 MB; timeout por requisição 10 s.

### 3.2 Regras de decisão (backend)

Limiares em env, calibrados com dados reais após piloto:

| Variável | Padrão | Uso |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | `0.45` | similaridade ≥ limiar → confere |
| `FACE_REVIEW_THRESHOLD` | `0.30` | entre review e match → "incerto" (também vai para revisão) |
| `FACE_LIVENESS_THRESHOLD` | `0.50` | score real abaixo → suspeita de spoof (ajustado após Fase 0; ver §10) |

Status do check-in (`face_status`):

| Status | Quando |
|---|---|
| `PENDENTE` | aguardando a fila |
| `CONFERE` | 1 rosto, liveness ok, similaridade ≥ match |
| `INCERTO` | similaridade entre review e match |
| `DIVERGENTE` | similaridade < review |
| `SPOOF_SUSPEITO` | liveness abaixo do limiar |
| `SEM_ROSTO` | 0 ou >1 rostos detectados |
| `SEM_BIOMETRIA` | médico sem biometria aprovada |
| `SEM_FOTO` | check-in sem foto (fluxo atual com motivo) |
| `ERRO` | face-service indisponível após 3 tentativas (backoff) |

`INCERTO`, `DIVERGENTE`, `SPOOF_SUSPEITO`, `SEM_ROSTO` e `ERRO` entram na fila **Divergências faciais** do Master. Nenhum deles bloqueia o ponto nem altera repasse automaticamente.

## 4. Modelo de dados (Prisma)

```prisma
enum StatusBiometriaFacial { PENDENTE_APROVACAO APROVADA REJEITADA }
enum FaceStatusPonto { PENDENTE CONFERE INCERTO DIVERGENTE SPOOF_SUSPEITO SEM_ROSTO SEM_BIOMETRIA SEM_FOTO ERRO }
enum RevisaoFacePonto { CONFIRMADO_MEDICO FRAUDE_SUSPEITA }

model MedicoBiometriaFacial {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  medicoId        String   @map("medico_id")
  status          StatusBiometriaFacial @default(PENDENTE_APROVACAO)
  fotoCaminho     String   @map("foto_caminho") @db.VarChar(512)
  embedding       Float[]                       // 512 floats, L2-normalizado
  modelo          String   @db.VarChar(60)      // ex.: "mobileface_mnet_v2"; troca de modelo exige re-cadastro
  livenessScore   Decimal? @map("liveness_score") @db.Decimal(5, 4)
  qualidade       Json?
  origem          String   @db.VarChar(30)      // CADASTRO_PUBLICO | PRIMEIRO_PONTO | MASTER
  consentimentoEm DateTime @map("consentimento_em")
  consentimentoVersao String @map("consentimento_versao") @db.VarChar(20)
  revisadoPorId   String?  @map("revisado_por_id")
  revisadoEm      DateTime? @map("revisado_em")
  motivoRejeicao  String?  @map("motivo_rejeicao") @db.VarChar(500)
  ativa           Boolean  @default(true)       // só 1 ativa por médico; histórico preservado
  createdAt       DateTime @default(now()) @map("created_at")
  @@map("medico_biometrias_faciais")
  @@index([tenantId, medicoId, ativa])
  @@index([tenantId, status])
}
```

`RegistroPonto` ganha:

| Campo | Tipo | Observação |
|---|---|---|
| `face_status` | `FaceStatusPonto?` | null em registros antigos |
| `face_similaridade` | `Decimal(5,4)?` | |
| `face_liveness` | `Decimal(5,4)?` | |
| `face_verificado_em` | `DateTime?` | |
| `face_biometria_id` | `String?` | qual referência foi usada |
| `face_revisao` | `RevisaoFacePonto?` | decisão do Master |
| `face_revisao_por_id` / `face_revisao_em` / `face_revisao_obs` | | |
| `offline` | `Boolean @default(false)` | |
| `capturado_em` | `DateTime?` | horário no aparelho (offline) |
| `sincronizado_em` | `DateTime?` | chegada no servidor |
| `client_uuid` | `String? @unique` | idempotência da sincronização |
| `foto_checkout_caminho` | `String?` | checkout sempre com foto (decidido) |
| `face_checkout_status` / `face_checkout_similaridade` / `face_checkout_liveness` | | mesma regra do check-in |
| `foto_expurgada_em` | `DateTime?` | retenção 90 dias |

## 5. Fluxos

### 5.1 Cadastro da biometria (selfie guiada)

1. Tela de captura com moldura oval, instruções ("rosto centralizado, sem óculos escuros/máscara, boa luz") e checagem local simples (vídeo ativo).
2. **Consentimento LGPD** explícito (dado biométrico é dado sensível — art. 11): checkbox com texto versionado; sem aceite não cadastra.
3. Backend → `face-service /v1/enroll`. Recusa na hora (com motivo amigável) se: nenhum/múltiplos rostos, liveness baixo, foto escura/borrada, rosto pequeno.
4. Grava `MedicoBiometriaFacial` em `PENDENTE_APROVACAO`.
5. Pontos de entrada:
   - **Cadastro público**: novo passo no formulário; aparece na tela **Avaliação** ao lado dos documentos (Master aprova junto com o cadastro, ou rejeita a selfie pedindo nova).
   - **Médicos existentes**: no primeiro ponto sem biometria, o app pede a selfie de cadastro antes do check-in (pode pular com aviso; o check-in fica `SEM_BIOMETRIA`). Master aprova na fila **Biometrias pendentes** ou na ficha do médico.
6. Enquanto pendente, os check-ins são comparados mesmo assim (status calculado normalmente, com aviso "referência não aprovada" na revisão). Se a biometria for rejeitada, o médico é notificado (in-app/push) para refazer.

### 5.2 Check-in online

1. Fluxo atual (geo + foto) inalterado; ao gravar o `RegistroPonto`, `face_status = PENDENTE` (ou `SEM_FOTO`/`SEM_BIOMETRIA`) e enfileira `face-verify { registroId }`.
2. Worker: carrega foto + embedding ativo → `/v1/verify` → aplica §3.2 → atualiza registro.
3. App: no histórico/tela do dia mostra selo (Confere / Em análise / Divergência). O médico **não** vê o score.

### 5.3 Offline

**Pré-requisito técnico:** o app Capacitor carrega a interface remota (`server.url`) e hoje **não há service worker** — sem internet o app nem abre. Necessário:
- `vite-plugin-pwa` (Workbox) para cachear o app shell e a rota do ponto.
- Android WebView: suporta service worker. **iOS WKWebView**: só com *App-Bound Domains* configurado (`WKAppBoundDomains` no Info.plist); validar em aparelho. Fallback iOS v1: offline funciona se o app já estava aberto quando a conexão caiu.

Fluxo:
1. Sem conexão (ou requisição falhou por rede), o botão de ponto passa a "Registrar offline".
2. Captura foto + GPS (`coords` + `accuracy`) + `capturadoEm` (relógio do aparelho) + `performance.now()`/tempo desde o último contato com o servidor + `escalaId` + `client_uuid`.
3. Salva em **IndexedDB** (foto como Blob comprimido ~200 KB; máx. 20 itens/7 dias). Mostra "Ponto guardado no aparelho — será enviado quando houver internet".
4. Ao voltar a conexão (`online`, app em foco, ou a cada 60 s): `POST /api/ponto/checkin-offline` (e `checkout-offline`) com o `client_uuid` → idempotente.
5. Servidor valida com os **dados da captura**: raio com o GPS capturado, janela de plantão com `capturadoEm`, regras de duplicidade/justificativa. Rejeita se `capturadoEm` > 24 h ou no futuro (> 5 min de folga). Grava `offline = true`, `face_status = PENDENTE` e segue a fila normal.
6. Anti-fraude: Master vê selo **Offline** com atraso de sincronização; diferença entre relógio do aparelho e do servidor no momento do envio é registrada; atrasos > 12 h vão para revisão.

### 5.4 Revisão do Master

- Nova tela **Ponto › Divergências faciais** (módulo `PONTO_ELETRONICO`): lista registros com status de revisão, filtros por contrato/período/status.
- Card lado a lado: foto de referência × foto do ponto, similaridade, liveness, offline/atraso, distância do ponto ao local.
- Ações: **É o profissional** (`CONFIRMADO_MEDICO`) / **Suspeita de fraude** (`FRAUDE_SUSPEITA` + observação obrigatória). Ambas auditadas (`createAuditLog`). Fraude não altera valores automaticamente — Master usa os fluxos existentes de ajuste.
- Relatório de ponto e histórico ganham coluna/selo do status facial (estende `SituacaoRegistroPonto.tsx`).
- Dashboard Master: card de alerta quando há divergências pendentes (mesmo padrão das justificativas).

## 6. Retenção e LGPD

- Job diário (BullMQ repeatable): apaga do disco fotos de check-in com mais de 90 dias **exceto** status de divergência não revisada ou revisada como `FRAUDE_SUSPEITA`; grava `foto_expurgada_em`. Score e status permanecem.
- Biometria de referência: mantida enquanto o médico estiver ativo; ao desativar/excluir o médico, apagar foto e embedding (job + hook).
- Fotos servidas apenas por rotas autenticadas (já existe padrão `GET /registros/:id/foto-checkin`).
- Texto de consentimento versionado em `contexto/` e na tela; registro de data/versão.

## 7. Segurança e desempenho

- face-service sem porta pública, token compartilhado, limite de 5 MB, rejeita formatos fora de JPEG/PNG/WebP.
- Fila com concorrência 1 + limite de jobs → no pior caso, atraso na validação, nunca VPS travada.
- Meta: < 400 ms por verificação em 1 vCPU (RetinaFace MobileNet + MobileFace + MiniFASNet em 640 px). Medir no benchmark da fase 0.
- Memória esperada do container: ~300–450 MB.

## 8. Fases de entrega

| Fase | Entrega |
|---|---|
| 0 | face-service + compose com limites + benchmark na VPS (latência, RAM) + calibração inicial com fotos de teste |
| 1 | Biometria: tabela, consentimento, selfie no cadastro público e no primeiro ponto, aprovação em Avaliação/ficha/fila |
| 2 | Verificação assíncrona do check-in, status no registro, tela de Divergências, selos em histórico/relatório, card no Dashboard |
| 3 | Offline: PWA/service worker, fila IndexedDB, endpoints idempotentes, selo Offline |
| 4 | Retenção 90 dias, expurgo de biometria de inativos, documentação `contexto/07` |

## 10. Resultados da Fase 0 (2026-10-02)

Ambiente: VPS 2 vCPU / 8 GB; container limitado a 1 vCPU, 768 MB, 64 PIDs, rootfs read-only. Imagem 255 MB (comprimida). Modelos: RetinaFace MNET_V2 (entrada 320), MobileFace MNET_V2, MiniFASNet V2+V1SE. Fotos de teste: `assets/source` do repositório UniFace (46 imagens).

| Métrica | Resultado |
|---|---|
| Latência por foto (detecção + embedding + liveness) | **35–55 ms** (picos ~100 ms) |
| 30 requisições simultâneas | todas 200; pior 1,9 s; total 2,5 s (fila serializada) |
| Memória | ~120 MB ocioso, ~190 MB sob carga |
| Mesma pessoa (fotos com 4–25 anos de diferença) | similaridade **0,47–0,68** |
| Pessoas diferentes | **≤ 0,25** (maioria < 0,10) |
| Foto de tela (spoof) | liveness 0,06 → detectado |
| Foto impressa (spoof) | liveness 0,54 → **não detectado** com limiar 0,5 |
| Fotos reais de banco de imagens (retocadas) | ~20% com liveness < 0,5 (falso alarme) |

Conclusões:
- Reconhecimento: separação boa; `FACE_MATCH_THRESHOLD=0.45` / `FACE_REVIEW_THRESHOLD=0.30` mantidos.
- Liveness é **sinal auxiliar**, não prova: pega tela, falha em foto impressa e dá falso alarme em fotos retocadas. Coerente com a política "sinaliza, não bloqueia". No cadastro só recusa liveness < 0,30 (`FACE_ENROLL_MIN_LIVENESS`); entre 0,30 e 0,50 aprova mas destaca para o Master.
- **Recalibrar com selfies reais de celular** do piloto (as fotos de teste não são capturas de câmera frontal) antes de qualquer bloqueio automático.
- Desempenho folgado: 1 vCPU atende com sobra; não há necessidade de modelo menor (MNET_025) por ora.

Arquivos: `face-service/` (Dockerfile, `app/engine.py`, `app/main.py`, `scripts/download_models.py`, `scripts/bench.sh`); serviço `face-service` em `docker-compose.yml` (+ nome `coopvitta-face-service` no override VPS); `FACE_SERVICE_TOKEN` no `.env`.

## 11. Estado da implementação (2026-10-02)

Fases 0–4 implementadas e em produção. Diferenças em relação ao desenho:
- Selfie do cadastro público vai no mesmo `POST /auth/register` (sem rota pública de biometria). Foto ruim → 422 na hora; serviço fora → cadastro segue sem selfie.
- Offline usa service worker próprio (`public/sw.js`) em vez de `vite-plugin-pwa`; fila trava no primeiro item recusado até o médico descartar (evita fechar o ponto errado).
- Retenção sai **desligada** (`PONTO_FOTO_RETENCAO_ATIVA`); ao ligar, a primeira execução apaga as fotos antigas já existentes.
- Pendente: App-Bound Domains no iOS; recalibrar limiares com selfies reais do piloto.

## 9. Fora de escopo v1 / em aberto

- ~~Foto no checkout opcional~~ → **decidido: checkout sempre exige foto + verificação** (mesmo fluxo/estados do check-in, incluindo "sem foto com motivo").
- Bloqueio automático por divergência: decidido "não" na v1; pode virar configuração por contrato depois de calibrar limiares.
- Comparação 1:N (descobrir *quem* está na foto): não é necessária (verificação 1:1 basta).
- Reconhecimento no próprio aparelho (on-device): não; processamento centralizado.
