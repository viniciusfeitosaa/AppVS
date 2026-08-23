# Mapa de bordo

**Snapshot:** 2026-08-23  
**Branch:** `main` — alinhada com GitHub (`e3c574a`+); mobile **1.0.4** (build 6), Android targetSdk 36; VPS com FCM ok; falta AAB/IPA + teste no aparelho

> Nome canónico: `contexto/mapa-de-bordo.md`.  
> Este arquivo deve ser o **primeiro** atualizado após entregas relevantes (o que está pronto, o que falta, histórico recente).

## Resumo executivo

O **Viva Saúde** está em produção na VPS (`sejavivasaude.com.br`). Auth, escalas, ponto, vagas, documentos, relatórios, painel de e-mail, robô WhatsApp (Evolution GO), mobile e deploy estão implementados.  
**Conteúdos / eventos** inclui anúncio, inscrição, frequência, **avaliação por conteúdo** (perguntas customizadas + switch na frequência) e **pipeline de precadastro → aceite → cadastro ATIVO no corpo clínico (sem Avaliação)**.  
**Push notifications** (FCM + BullMQ): código na `main`, VPS com migration, worker e **Firebase service account**; **falta novo AAB/IPA e teste no celular** — `12-mobile-capacitor.md`.

## Módulos — status

| Módulo | Backend | Frontend | Notas |
|--------|---------|----------|-------|
| Auth / cadastro | ✅ | ✅ | 3 fluxos de login; `/cadastro` → Avaliação |
| Dashboard | ✅ | ✅ | |
| Médicos | ✅ | ✅ | Convites, status cadastro; ATIVO via convite **ou** precadastro aceito |
| Contratos | ✅ | ✅ | |
| Escalas / plantões | ✅ | ✅ | Trocas; **multi-escala no mesmo mês** (médico); **1 escala por equipe** — `06` |
| Valores plantão/ponto | ✅ | ⏳ | Por contrato/escala; UI com **margem %** (só front). **Pendente:** inverter motor — cobrança + % → repasse (spec `2026-08-22-margem-cobranca-primeiro-design.md`) — `06`/`07` |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico; seletor de escala; **justificativa ausência** (`JUSTIFICADO_SEM_PONTO`) — `07` |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Procedimentos + ponto + **plantões só-escala** no hub financeiro — `10` |
| Painel de E-mail | ✅ | ✅ | NF / demonstrativos com PDF anexo + 2 tipos de competência |
| WhatsApp (Evolution GO) | ✅ | — | Menu atendimento; pausar/retomar (equipe) |
| Conteúdos / eventos | ✅ | ✅ | Anúncio, frequência, **avaliação custom por evento**, precadastro→aceite→corpo clínico — `17-conteudos-eventos.md` |
| Mobile / Capacitor | ✅ | ✅ | **1.0.4** (build 6), targetSdk 36; FCM na VPS ok; falta AAB/IPA + teste — `12` |
| Configurações / módulos | ✅ | ✅ | Matriz de acesso MASTER/MEDICO |
| Perfis staff / escalista | ✅ | ✅ | `PerfilAcesso` OFF/VER/EDITAR; `/perfis-equipe`; Escalas v1 — `04` |
| Avaliação (master) | ✅ | ✅ | Só cadastro público `/cadastro` (não precadastro aceito); CFM abre o portal sem pré-preenchimento |
| Atendimentos | — | ⏳ Placeholder | `FeaturePlaceholder` |
| Landing | ✅ | ✅ | + pasta `landing/` |

## Confirmação de regra de negócio — multi-escala / multi-contrato

**Pergunta (2026-08-04):** médico pode trabalhar no mesmo mês em mais de uma escala de contratos diferentes (ex.: UPA São Miguel noite + UPInha Infantil manhã) e o sistema ainda calcula quanto recebe?

**Resposta: SIM — já suportado.**

| Aspecto | Comportamento |
|---------|----------------|
| Modelo | `Escala` → 1 `contratoAtivoId`; médico em N escalas via `EscalaMedico` / plantões / ponto |
| Mesmo mês | Sem unique "1 contrato ou 1 escala por médico por mês" |
| Valor | Por escala/contrato: `EscalaMedico.valorHora`, plantão, `ValorPlantao` do contrato, `repasseValorCongelado` no ponto |
| Relatório | Agrupa por **médico + escala** (`medicoId::escalaId`) e soma repasses |
| Operação | Precisa alocar o médico em cada escala e registrar plantão/ponto na escala correta |
| Limitação | Não valida conflito de horário **entre** escalas/contratos diferentes; ponto tem 1 `escalaId` por registro |

Arquivos de referência: `schema.prisma` (`Escala`, `EscalaMedico`, `EscalaPlantao`, `ValorPlantao`, `RegistroPonto`), `repasse-registro-ponto.service.ts`, `Relatorios.tsx`, `PontoEletronico.tsx`.

## Qualidade

| Item | Status |
|------|--------|
| Testes backend Jest | ✅ |
| Migrations Prisma | ✅ |
| CI GitHub Actions | ✅ `ci.yml`, `deploy-vps.yml` |
| Docs raiz README/CHECKLIST | ⚠️ Desatualizados |
| Ícone PWA | ✅ Viva Saúde (VS), não CoopVitta |

## Pendências prioritárias

1. **Perfis staff (VPS + smoke)** — `prisma migrate deploy` (`20260814210000_perfil_acesso_staff`); criar perfil Escalista; login staff VER vs EDITAR — `04-autenticacao-acessos.md`
2. **Justificativa de ponto (VPS + E2E)** — `prisma migrate deploy` (`20260813200000_justificativa_ausencia_ponto`); restart backend; teste manual médico → Master aceita → badge + bloqueio check-in — `07-ponto-eletronico.md`
3. **Push (VPS + store)** — copiar service account JSON; `FIREBASE_SERVICE_ACCOUNT_PATH` (ou `_JSON`); `prisma migrate deploy` (`device_push_tokens`); restart backend; novo AAB/IPA — ver checklist em `12-mobile-capacitor.md`
4. **Atendimentos** — definir escopo e implementar (hoje só placeholder)
5. **Sincronizar README/CHECKLIST** ou marcar como arquivados apontando para `contexto/`
6. **Margem na UI (ValoresPonto / ValoresPlantao)** — implementar spec [`2026-08-22-margem-cobranca-primeiro-design.md`](../docs/superpowers/specs/2026-08-22-margem-cobranca-primeiro-design.md): ordem Cobrança → Margem → Repasse; `repasse = cobrança × (1 − %)` (não markup); sem migration
7. **Harness** — manter esta pasta após cada feature (ver `16-como-atualizar.md`)
8. **WhatsApp** — health no `/health` do backend (ping Evolution GO); painel master opcional (QR/status)

## Pendências menores

- Documentar estados finitos de `SolicitacaoTrocaPlantao` em `06-escalas-plantoes.md`
- Processo de publicação App Store / Play Store em `12-mobile-capacitor.md`
- Tabela de endpoints de vagas em `08-vagas.md`
- Detalhar multi-escala em `06-escalas-plantoes.md` (já confirmado no código; falta doc dedicada)
- Conteúdos: evoluções opcionais em `17-conteudos-eventos.md` (OTP frequência, docs no cadastro-corpo)

## Histórico de entregas recentes

| Data | Entrega |
|------|---------|
| 2026-08-23 | **Margem (design)** — spec aprovado: cobrança + % → repasse (`× (1 − %)`); não é markup; UI invertida vs. entrega 2026-08-14 — spec `2026-08-22-margem-cobranca-primeiro-design.md` — **implementação pendente** |
| 2026-08-22 | **Mobile 1.0.4** + targetSdk 36; uploads persistentes; validação CPF/CRM no cadastro; nomes no demonstrativo — `12` |
| 2026-08-19 | **Avaliação → CFM** — botão só abre o portal (sem pré-preenchimento nem tela intermediária) — `05`/`11` |
| 2026-08-19 | **UAT faturamento misto** — seed + HTML com 2 escalas (ponto 120/h e só-escala 100/h, margem 25%) e 2 médicos teste — `10` |
| 2026-08-18 | **Fechamento só-escala** — relatório financeiro por plantão alocado; painel de ponto filtra escalas sem `usaPonto`; ValoresPonto oculta subgrupo só-escala; menu Somente escala → `VALORES_PLANTAO` — `06`/`07`/`10` |
| 2026-08-14 | **Margem de lucro na UI** — Repasse + % + Cobrança em ValoresPonto e ValoresPlantao (sem coluna no DB) — `06`/`07` |
| 2026-08-14 | **Perfis de acesso staff** — `PerfilAcesso` OFF/VER/EDITAR; `/perfis-equipe`; Escalas read-only se VER; migration `20260814210000` — `04` |
| 2026-08-14 | **Tipos de plantão** movidos para Escalas (aba Tipos); ValoresPlantao só aponta link — `06` |
| 2026-08-14 | **1 escala por equipe** — UI `SubgruposEquipes` + API 409 ao vincular segunda; excluir libera nova — `06` |
| 2026-08-13 | **Justificativa de ausência de ponto** — pedido médico, fila Master, `JUSTIFICADO_SEM_PONTO` valor cheio, badge; falta migration VPS + E2E — `07` |
| 2026-08-13 | **Push notifications** FCM iOS/Android + BullMQ + broadcast Master; Firebase `viva-saude-d4644` + APNs; falta VPS — `12` |
| 2026-08-12 | Conteúdos: aba **Palestrantes** no Master — lista, busca e detalhe (dados + conteúdos vinculados) |
| 2026-08-07 | Conteúdos: **painel de resultados da avaliação** — stats por pergunta, textos e respostas individuais |
| 2026-08-07 | Conteúdos: avaliação com tipo **questão (gabarito)** — opções + resposta correta no admin; gabarito oculto no app/link |
| 2026-08-07 | WhatsApp: após dados de contato, **pergunta a dúvida** (etapa `collecting_duvida`) em todos os setores |
| 2026-08-07 | Conteúdos: **avaliação por conteúdo** — editor de perguntas + switch na Frequência (mostrar ou não na presença) |
| 2026-08-05 | Conteúdos: **aceite de precadastro** → e-mail + cadastro `ATIVO` (**sem Avaliação**) — opção A; mapa de bordo |
| 2026-08-05 | Conteúdos: popup detalhe precadastro; **excluir** participante/precadastro |
| 2026-07-31 | Conteúdos: CPF no palestrante; sem URL de foto no form |
| 2026-08-04 | WhatsApp: **pausar** sem expirar em 24h — só volta com `retomar` |
| 2026-08-04 | Painel de E-mail → **Demonstrativos** com PDF; 2 competências |
| 2026-08-04 | Confirmação **multi-escala/multi-contrato no mesmo mês** |
| 2026-07-31 | Conteúdos: **frequência** na aula + perfil médico/estudante/CPF — `17` |
| 2026-07-30 | Conteúdos: anúncio sem YouTube; WhatsApp pausar/retomar equipe |
| 2026-07-21 | Logo VS PDFs; ícone PWA VS |
| 2026-07 | Painel e-mail, Evolution GO |
| 2026-04 | Trocas de plantão |
| 2026-03 | Módulo vagas, valores plantão |

### Detalhe — Margem na UI: cobrança como ponto de partida (2026-08-23)

**Problema:** a entrega de 2026-08-14 partia do **repasse** e calculava cobrança (`÷ (1 − %)` → ex.: 100 e 25% → **133,33**). A operação pensa ao contrário: define **cobrança** + margem; o repasse é o que sobra. Não é markup (`× 1,25` → 125).

**Decisão (spec aprovado):**

| Tema | Valor |
|------|--------|
| Fórmula | `repasse = cobrança × (1 − margem/100)` |
| Exemplo | Cobrança **100**, margem **25%** → repasse **75** |
| UI | Ordem: **Cobrança → Margem (%) → Repasse**; editar cobrança/margem recalcula repasse |
| Persistência | Inalterada — só R$/h absolutos na API/DB; % só no draft |
| Escopo | `ValoresPonto.tsx`, `ValoresPlantao.tsx`, `margemLucro.ts` |

**Status:** spec em [`docs/superpowers/specs/2026-08-22-margem-cobranca-primeiro-design.md`](../docs/superpowers/specs/2026-08-22-margem-cobranca-primeiro-design.md) — **implementação pendente**.

**UAT faturamento:** valores absolutos (ex.: cob. 120 / rep. 90) continuam válidos; a relação 25% de margem é a mesma.

### Detalhe — Justificativa de ausência de ponto (2026-08-13)

**Objetivo:** médico que não concluiu o ponto (esqueceu check-out ou não bateu) solicita justificativa; Master aprova com **valor cheio do plantão**; histórico deixa explícito que não houve ponto real.

| Item | Comportamento |
|------|----------------|
| Elegibilidade | Sem ponto **fechado** no dia/escala; inclui “só check-in”; bloqueia se `PENDENTE`/`ACEITA` no plantão |
| Aceite | Cancela ponto aberto sem repasse; cria `RegistroPonto` `JUSTIFICADO_SEM_PONTO`; horários = auditoria |
| Pós-aceite | Check-in normal bloqueado no mesmo dia/escala; badge **Sem ponto — justificado** |
| API médico | `GET/POST /api/ponto/justificativas-ausencia/…` |
| API Master | `GET/POST /api/admin/justificativas-ausencia/…` (módulo `PONTO_ELETRONICO`) |

**Migration:** `20260813200000_justificativa_ausencia_ponto` — **pendente na VPS** + teste E2E manual.

**Arquivos:** `justificativa-ausencia-ponto.service.ts`, `JustificarAusenciaPonto.tsx`, `JustificativasPontoAdmin.tsx`, `SituacaoRegistroPonto.tsx`, `contexto/07-ponto-eletronico.md`

### Detalhe — Conteúdos: avaliação da aula por evento (2026-08-07)

**Objetivo:** cada conteúdo tem suas próprias perguntas de avaliação (não só template fixo). Exibir ou ocultar na tela de frequência via switch.

| Item | Comportamento |
|------|----------------|
| Editor (admin) | Em **Avaliação da aula**: criar/editar/remover/reordenar perguntas (estrelas, múltipla escolha, texto livre); opcional “modelo Viva Atualiza” só como atalho |
| Switch (admin) | Em **Frequência**: slide “Perguntas na tela de frequência” — se **ligado**, perguntas aparecem ao confirmar presença; se **desligado**, só registra presença |
| App + link público | Respeitam `avaliacaoAtiva` + formulário salvo; respostas em `avaliacao_respostas` / `avaliado_em` no participante |
| Ativação | Switch só liga se já existirem perguntas salvas |

**Schema / migration:** `avaliacao_ativa`, `avaliacao_formulario` em `conteudo_eventos`; respostas no participante — `20260807140000_conteudo_avaliacao_frequencia`

**API admin (resumo):** `PUT …/eventos/:id/avaliacao` (salvar form); `PATCH …/avaliacao/ativa`; atalho template Viva Atualiza

**Arquivos:** `conteudo-avaliacao.const.ts`, `conteudo.service.ts`, rotas admin, `AvaliacaoEditorAdmin.tsx`, `AvaliacaoPerguntasForm.tsx`, `ConteudosAdminPage.tsx`, `ConteudoFrequenciaPublicPage.tsx`, `ConteudoMedicoDetalhePage.tsx`

### Detalhe — Conteúdos: precadastro → corpo clínico (2026-08-05)

**Decisão:** precadastro **não** é corpo clínico. Aceite da equipe **substitui** Avaliação (opção A).

| Passo | O quê |
|-------|--------|
| 1 | Externo se inscreve no conteúdo → `ConteudoParticipante` `origem=EXTERNO` |
| 2 | Aparece em **Precadastros** (status `AGUARDANDO`) |
| 3 | Master seleciona um/todos → **Aceitar** → e-mail + `ACEITO` + `tokenCadastroCorpo` |
| 4 | Link `/conteudos/cadastro-corpo/:token` completa dados (senha, profissão, faltantes) |
| 5 | Cria `Medico` **`ATIVO` + `ativo=true`** → status `CONVERTIDO` |

**Vs Avaliação**

| Origem | Após preencher dados |
|--------|----------------------|
| Precadastro **aceito** pela equipe | `ATIVO` na hora — **não** lista em Avaliação |
| Cadastro público `/cadastro` | `PENDENTE_ANALISE` — **vai** para Avaliação |
| Convite admin (`/ativar-conta`) | `ATIVO` na hora (já existia) |

**UI admin (Precadastros):** checkbox, selecionar todos, Aceitar, popup de dados, badges, Excluir.

**Migration:** `20260805153000_conteudo_precadastro_aceite`

**Arquivos:** `conteudo.service.ts`, `cadastro-publico-email.service.ts`, rotas admin/public, `ConteudosAdminPage.tsx`, `ConteudoCadastroCorpoPublicPage.tsx`, `contexto/17-conteudos-eventos.md`

### Detalhe — Demonstrativos no Painel de E-mail (2026-08-04)

Espelha o fluxo de produção/NF: copiar tabela → e-mail individual + PDF anexo. Ver componentes em `frontend/src/modules/email/`.

### Detalhe — WhatsApp pausar/retomar (2026-07-30)

- **Quem controla:** apenas mensagens `IsFromMe` no WhatsApp da Viva Saúde
- **Pausa permanente** até `retomar` / `despausar` / `ativar` (sem TTL 24h)
- **Arquivos:** `whatsapp-atendimento.service.ts`, `whatsapp-jid.util.ts`, `evolution-whatsapp.service.ts`

*Adicione linhas na tabela ao fechar tarefas.*
