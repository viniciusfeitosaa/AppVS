# 07 — Ponto eletrônico

**Status:** ✅ Implementado (+ justificativa Master “Sem ponto” + criar-e-aceitar)  
**Última atualização:** 2026-10-02

## Funcionalidades

- Check-in / check-out (com foto ou `checkin-sem-foto`)
- Geolocalização e endereço configuráveis (`ConfigPontoEletronico`)
- Horário e tolerância de ponto
- Valores por dia (`valores_ponto_por_dia` migration)
- Histórico do médico e painel do dia
- Repasse/registro congelado (`repasse-registro-ponto.service.ts`)
- Índices de performance (`perf_ponto_indexes`, check-in médico)
- **Justificativa de ausência de ponto** — médico pede quando não concluiu o ponto; Master aceita/recusa; aceite gera `RegistroPonto` com origem `JUSTIFICADO_SEM_PONTO` e **valor cheio do plantão**
- **Reconhecimento facial (UniFace)** — foto de referência + verificação assíncrona da entrada e da saída; sinaliza para o Master, **nunca bloqueia** (ver seção abaixo)
- **Ponto offline** — fila no aparelho (IndexedDB) e envio automático quando a internet volta

## Modelos Prisma

- `ConfigPontoEletronico` — regras por escala/equipe
- `RegistroPonto` — registros (`OrigemRegistroPonto`: `APP_MEDICO` | **`JUSTIFICADO_SEM_PONTO`**)
- `JustificativaAusenciaPonto` — pedido separado (`status`: `PENDENTE` | `ACEITA` | `RECUSADA`); amarra `escalaPlantaoId`; no aceite preenche `registroPontoId`
- `escalaId` opcional em registro (migration `registro_ponto_escala_optional`)

**Migration:** `20260813200000_justificativa_ausencia_ponto` — enum `JUSTIFICADO_SEM_PONTO`, tabela `justificativas_ausencia_ponto`, índice único parcial (1 `PENDENTE` por plantão)

## Justificativa de ausência — fluxo

### Médico

1. Abre **Justificar ausência de ponto** (menu Ponto).
2. API lista plantões **elegíveis** (`GET …/eligiveis`).
3. Escolhe plantão → informa horários alegados (entrada/saída) + motivo.
4. Pedido fica `PENDENTE`; acompanha em **Minhas justificativas**.

### Master

1. Fila em **Justificativas de ponto** (módulo `PONTO_ELETRONICO`).
2. Área **Sem ponto no plantão**: lista plantões recentes sem ponto fechado; botão **Decidir**.
3. Com pedido pendente: Aceitar / Recusar. **Entrada/saída alegada** (pedido ou horário do plantão, dia/hora corretos) + **entrada/saída consideradas** (o que vai para o ponto); botão **Replicar alegado → considerado**. Valor do plantão **não** muda com os horários.
4. Sem pedido: **Justificar e aceitar** (`POST …/criar-e-aceitar`) — mesmo par alegado/considerado + motivo; aceite usa o **considerado**.
5. **Aceitar** (transação):
   - Revalida elegibilidade (ainda sem ponto **fechado** no dia/escala).
   - Se existir ponto **aberto** no mesmo dia/escala → **remove** (sem repasse).
   - Cria `RegistroPonto` `JUSTIFICADO_SEM_PONTO` com `repasseValorCongelado` = **valor cheio do plantão**.
   - Marca justificativa `ACEITA` + notificação in-app (+ push FCM se configurado).
6. **Recusar** → `RECUSADA` + comentário opcional + notificação; ponto aberto (se houver) **permanece**.
7. **Pré-requisito de valor:** sem valor cadastrado no plantão/contrato → 400 com mensagem orientando Valores de Plantão.

### Pós-aceite

- Check-in normal **bloqueado** no mesmo dia/escala se já há justificativa `ACEITA` (evita segundo pagamento).
- Histórico e relatórios: badge **“Sem ponto — justificado”** (`SituacaoRegistroPonto.tsx`).
- Troca de plantão: se `escalaPlantao.medicoId` ≠ médico da justificativa, aceite falha com 409 (pedido pendente do médico antigo fica inválido na prática).

## Matriz de elegibilidade (criar pedido)

| Situação no plantão (médico + escala + dia do `EscalaPlantao`) | Elegível? |
|----------------------------------------------------------------|-----------|
| Nenhum check-in e nenhum check-out | **Sim** |
| Check-in feito, **sem** check-out (ponto aberto) | **Sim** |
| Check-in e check-out concluídos (`checkOutAt` preenchido) | **Não** |
| Justificativa `PENDENTE` ou `ACEITA` no plantão | **Não** |
| Após `RECUSADA` | **Sim** (novo pedido permitido) |

**Pré-requisitos adicionais:** vínculo na escala com produção **usa escala + usa ponto** (`allowPonto` + `requireJanelaPlantao`); médico autenticado = `medicoId` do slot. Sem prazo/competência na v1.

## Pagamento no aceite

Valor **cheio do plantão** (horários alegados/considerados não entram na fórmula):

1. `EscalaPlantao.valorHora` > 0 → total do plantão
2. Senão, `ValorPlantao` do contrato/grade (tela **Valores de Plantão**)
3. Senão, **Configuração de Ponto** (`config_ponto_eletronico` — tela **Valores de Ponto**): R$/h da equipe do médico na escala × duração oficial do turno
4. Senão, `EscalaMedico.valorHora` × duração oficial do turno
5. Senão → aceite falha (`Sem valor de plantão cadastrado`)

Helper: `justificativa-ausencia-ponto.valor.ts` (`resolverValorCheioPlantao`).

## API (`/api/ponto`)

Arquivo: `ponto.routes.ts` + `ponto.controller.ts` + `ponto.service.ts`

Exemplos:

- `POST /checkin`, `POST /checkout`, `POST /checkin-sem-foto`
- `GET /meu-dia`, `GET /historico`, `GET /can-checkin`
- Troca de plantão (ver também etapa 06)
- `GET /registros/:id/foto-checkin` — download autenticado

### Justificativa (médico)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/justificativas-ausencia/eligiveis` | Plantões elegíveis |
| POST | `/justificativas-ausencia` | Criar pedido (`escalaPlantaoId`, horários alegados, `motivo`) |
| GET | `/justificativas-ausencia/minhas` | Histórico do médico |

Service: `justificativa-ausencia-ponto.service.ts` + `justificativa-ausencia-ponto.controller.ts`

## Utils e testes

- `ponto-geo-config.util.ts` (+ testes Jest)
- `ponto.const.ts` — constantes de negócio
- `justificativa-ausencia-ponto.service.test.ts`, `.valor.test.ts`, `ponto.service.checkin-justificativa.test.ts`

## Frontend

| Arquivo | Função |
|---------|--------|
| `PontoEletronico.tsx` | Tela principal |
| `HistoricoPontos.tsx` | Histórico |
| `ValoresPonto.tsx` | Valores admin (repasse + **margem %** + cobrança por dia; margem só na UI) |
| `RelatoriosPontoEletronico.tsx` | Relatórios |
| `JustificarAusenciaPonto.tsx` | Médico: pedir justificativa de ausência |
| `JustificativasPontoAdmin.tsx` | Master: fila aceitar/recusar justificativas |
| `SituacaoRegistroPonto.tsx` | Badge **Sem ponto — justificado** |
| `PontoLocationMap.tsx` | Mapa Leaflet |
| `PontoEnderecoMapaBlock.tsx` | Endereço no mapa |

## Admin

- `GET/PUT /api/admin/config-ponto`
- `GET /api/admin/registros-ponto` (módulo `RELATORIOS`)
- `GET /api/admin/justificativas-ausencia?status=` — fila Master (`PONTO_ELETRONICO`)
- `GET /api/admin/justificativas-ausencia/plantoes-sem-ponto?dias=` — visão “Sem ponto no plantão”
- `POST /api/admin/justificativas-ausencia/criar-e-aceitar` — Master justifica e aceita sem pedido do médico
- `POST /api/admin/justificativas-ausencia/:id/aceitar` — body opcional: `horarioAlegadoEntrada`, `horarioAlegadoSaida`
- `POST /api/admin/justificativas-ausencia/:id/recusar` — body opcional: `comentario`

## Reconhecimento facial e offline

Spec completo: `docs/superpowers/specs/2026-10-02-ponto-reconhecimento-facial-design.md`.

**Serviço:** container `face-service` (Python/FastAPI, onnxruntime CPU, 1 vCPU / 768 MB, sem porta pública, token `FACE_SERVICE_TOKEN`). Modelos: RetinaFace MNET_V2, MobileFace MNET_V2, MiniFASNet V2+V1SE. Sem `FACE_SERVICE_URL`/`TOKEN` no backend a verificação fica desligada (pontos sem status facial).

**Foto de referência** (`MedicoBiometriaFacial`): selfie no cadastro público (campo `selfieBiometria` em `POST /auth/register`) ou no primeiro ponto (`POST /ponto/biometria`), sempre com consentimento LGPD versionado (`FACE_CONSENTIMENTO_VERSAO`, texto em `frontend/src/constants/biometria.ts`). Fica `PENDENTE_APROVACAO`; aprovar o cadastro na Avaliação aprova a selfie; rejeitar o cadastro apaga a selfie na hora.

**Verificação:** fila BullMQ `coopvitta-face-verify` (concorrência 1) grava `faceStatus` / `faceCheckoutStatus` (`CONFERE`, `INCERTO`, `DIVERGENTE`, `SPOOF_SUSPEITO`, `SEM_ROSTO`, `SEM_BIOMETRIA`, `SEM_FOTO`, `ERRO`). Limiares: `FACE_MATCH_THRESHOLD` 0,45, `FACE_REVIEW_THRESHOLD` 0,30, `FACE_LIVENESS_THRESHOLD` 0,50. Checkout **sempre** pede foto (ou motivo ≥ 15 caracteres). Médico vê só o selo (`faceSituacao`), sem score — no histórico e nos registros de hoje da tela de ponto (atualiza a cada 5 s enquanto está "Conferindo rosto…").

**Conferência na hora:** antes de registrar (online, com foto de referência), o app chama `POST /api/ponto/biometria/conferir` (foto descartável em `uploads/tmp-conferir-rosto`, apagada após a resposta). Resultado `CONFERE` registra direto ("Rosto reconhecido"); `NAO_CONFERE` / `SEM_ROSTO` / `SPOOF_SUSPEITO` mostram a foto com aviso e as opções **Tirar outra foto** ou **Registrar assim mesmo** (vai para revisão do Master — nunca bloqueia). Serviço indisponível ou sem biometria: registra sem conferência. O status oficial continua vindo da fila.

**Master:** tela **Reconhecimento facial** (`/reconhecimento-facial`, módulo `PONTO_ELETRONICO`) com abas Divergências (referência × entrada × saída, "É o médico" / "Suspeita de fraude") e Fotos de referência (aprovar/rejeitar). Card no Dashboard e coluna "Reconhecimento facial" no relatório de ponto.

**Offline:**
- `public/sw.js` (servido em `/app/sw.js`, sem cache no nginx) guarda só a interface; nunca intercepta `/api/`. Desligar: build com `VITE_SW_DESATIVADO=true`.
- Fila em IndexedDB (`lib/pontoOfflineQueue.ts`, máx. 20 itens), sincronizada em ordem por `usePontoOffline` (evento online, foco, a cada 60 s). Com fila pendente, novos pontos também entram na fila. Recusa do servidor trava a fila até o médico descartar o item.
- `POST /ponto/checkin-offline` e `/checkout-offline` (multipart): `clientUuid` (idempotente), `capturadoEm` e `enviadoEm` no relógio do aparelho. Horário gravado = captura corrigida pelo desvio do relógio (`utils/ponto-offline.util.ts`). Recusa > 24 h; marca `offlineRevisar` se sincronizou > 12 h depois ou relógio desviado > 10 min (entra na lista de divergências).
- Sessão: com token vencido e **sem internet** o app mantém o usuário logado; ao reconectar, o 401 pede login e a fila (por médico) é enviada depois.
- iOS (WKWebView) só roda service worker com App-Bound Domains — não configurado ainda; Android e navegador funcionam.

**Retenção** (`jobs/ponto-foto-retencao-job.ts`, diário): apaga fotos de ponto com mais de `PONTO_FOTO_RETENCAO_DIAS` (90) exceto verificação pendente, divergência ou offline sem revisão e suspeita de fraude; grava `fotoExpurgadaEm`. Apaga biometria de médico desativado após aprovação ou rejeitado. **Desligado por padrão**: sem `PONTO_FOTO_RETENCAO_ATIVA=true` só registra no log o que apagaria.

**Migrations:** `20261002180000_ponto_reconhecimento_facial`, `20261002200000_ponto_foto_expurgo`, `20261002210000_ponto_offline`.

## Changelog

### 2026-10-02 — Reconhecimento facial + offline + retenção
- face-service (UniFace) no compose; biometria, verificação de entrada e saída, tela Reconhecimento facial, selos no histórico/relatório/Dashboard
- Selfie opcional no cadastro público; selfie na Avaliação
- Ponto offline (service worker + IndexedDB + endpoints idempotentes)
- Job de retenção de fotos (desligado até `PONTO_FOTO_RETENCAO_ATIVA=true`)

### 2026-09-14 — Justificativa aceita Valores de Ponto
- `resolverValorCheioPlantao` também lê `config_ponto_eletronico` (R$/h × horas do turno) quando não há linha em `valores_plantao`
- Corrige 400 em contratos só-ponto (ex.: Santa Quitéria) que já tinham valores em **Valores de Ponto**
- Arquivos: `justificativa-ausencia-ponto.valor.ts`

### 2026-09-14 — Alegado vs considerado + dia/hora corretos
- `datetime-local` e labels de plantão usam face do relógio UTC (sem −3h no browser BR)
- UI Master: campos **considerados** + botão **Replicar alegado → considerado**; aceite grava o considerado no ponto
- Backend: `inicioPlantaoAsDate` / `fimPlantaoAsDate` com `Date.UTC` (independente do TZ do Node)
- Arquivos: `plantao-datetime-local.ts`, `JustificativasPontoAdmin.tsx`, `JustificarAusenciaPonto.tsx`, `plantao-horario.ts`

### 2026-09-04 — Criar-e-aceitar: valor obrigatório + sem PENDENTE órfã
- Valida `resolverValorCheioPlantao` **antes** de criar justificativa; mensagem pede cadastro em Valores de Plantão
- Se aceite falhar após create, remove PENDENTE
- Arquivos: `justificativa-ausencia-ponto.service.ts`, `JustificativasPontoAdmin.tsx`

### 2026-09-01 — Sem ponto no plantão (Master)
- Lista plantões sem ponto fechado; Decidir / Justificar e aceitar; inclusão por escala que exige ponto (equipes/subgrupos/contrato)
- Datas em fuso SP; só plantão já iniciado
- Arquivos: `escala-requer-ponto.util.ts`, `sao-paulo-data.util.ts`, `JustificativasPontoAdmin.tsx`

### 2026-08-23 — Margem: spec cobrança → repasse (pendente código)
- Decisão: `repasse = cobrança × (1 − margem/100)`; UI Cobrança → Margem → Repasse (não markup)
- Spec: `docs/superpowers/specs/2026-08-22-margem-cobranca-primeiro-design.md`
- Entrega 2026-08-14 (repasse → cobrança) será substituída na UI; R$ gravados no DB não mudam

### 2026-08-14 — Margem de lucro na UI de valores (ponto)
- Em `ValoresPonto`, grade semanal com Repasse + Margem (%) + Cobrança; motor **legado** `cobrança = repasse ÷ (1 − margem/100)` — **será invertido** (ver 2026-08-23)
- Margem não é persistida — só repasse/cobrança absolutos na API
- Helper: `frontend/src/utils/margemLucro.ts`

### 2026-08-14 — Alerta de justificativas no Dashboard Master
- Card âmbar abaixo do acesso rápido quando há pedidos `PENDENTE`, com preview e link para `/justificativas-ponto`
- Arquivo: `Dashboard.tsx`

### 2026-08-13 — Status de ponto batido nos elegíveis
- `GET …/eligiveis` inclui `situacaoPonto` (`NENHUM` | `SO_ENTRADA`) + `checkInAt`
- UI: abas Todos / Nenhum ponto / Só entrada + coluna “Ponto batido”
- Spec: `docs/superpowers/specs/2026-08-13-elegiveis-status-ponto-design.md`
- Arquivos: `justificativa-ausencia-ponto.service.ts`, `JustificarAusenciaPonto.tsx`

### 2026-08-13 — Justificativa de ausência de ponto (v1)
- Pedido `JustificativaAusenciaPonto` → Master aceita/recusa → `RegistroPonto` `JUSTIFICADO_SEM_PONTO` com valor cheio
- Elegível: sem ponto fechado (inclui “só check-in”); bloqueia check-in pós-aceite; aceite cancela ponto aberto sem repasse
- Notificação in-app + push no aceite/recusa
- Seeds UAT: `seed-justificativas-ponto-demo.ts` (fila PENDENTE) e `seed-plantao-sem-justificativa-demo.ts` (elegível sem pedido)
- Migration: `20260813200000_justificativa_ausencia_ponto`
- Spec: `docs/superpowers/specs/2026-08-13-justificativa-ausencia-ponto-design.md`
- Arquivos: `justificativa-ausencia-ponto.service.ts`, rotas ponto/admin, `JustificarAusenciaPonto.tsx`, `JustificativasPontoAdmin.tsx`, `SituacaoRegistroPonto.tsx`

## Seeds locais (UAT manual)

```bash
cd backend
# Fila Master com 3 PENDENTE
npx ts-node --transpile-only scripts/seed-justificativas-ponto-demo.ts
# Plantão elegível SEM justificativa (médico ainda não pediu) — fluxo médico → Master
npx ts-node --transpile-only scripts/seed-plantao-sem-justificativa-demo.ts
```

## Pendências

- [ ] **Margem UI:** implementar spec `2026-08-22-margem-cobranca-primeiro-design.md` em `ValoresPonto.tsx`
- [ ] **VPS:** `prisma migrate deploy` (`20260813200000_justificativa_ausencia_ponto`) + restart backend
- [ ] **Teste E2E manual:** médico pede → Master aceita → badge no histórico/relatório + bloqueio de check-in duplicado
- [ ] Validar regras de geo em produção por tenant

## Changelog

### 2026-08-18 — Painel de ponto esconde escala só-escala
- `listMinhasEscalas` (tela de ponto) remove escalas em que **nenhuma** equipe tem `usaPonto`
- `ValoresPonto` oculta subgrupos só-escala (valores ficam em Valores Plantão)
- Arquivos: `ponto.service.ts`, `ValoresPonto.tsx`
