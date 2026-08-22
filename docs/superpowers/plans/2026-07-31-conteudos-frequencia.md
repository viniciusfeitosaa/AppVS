# Frequência em Conteúdos — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin abre/fecha frequência na aula; médico confirma logado; externo confirma com o e-mail da inscrição.

**Architecture:** Campos em `ConteudoEvento` / `ConteudoParticipante`; endpoints admin + médico + público com `tokenFrequencia`; UI admin (bloco Frequência), detalhe médico e página pública `/conteudos/frequencia/:token`.

**Tech Stack:** Prisma/Postgres, Express, React Query, React Router.

**Spec:** `docs/superpowers/specs/2026-07-30-conteudos-frequencia-design.md`

## Global Constraints

- Sem código/OTP na v1
- Uma presença por inscrito (`presenteEm`)
- Falhas no POST público: mensagem genérica
- Rate limit no POST público (`publicFormLimiter`)

---

### Task 1: Schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260731120000_conteudo_frequencia/migration.sql`

- [ ] Add enum `ConteudoPresencaOrigem` (`APP`, `LINK_PUBLICO`)
- [ ] `ConteudoEvento`: `tokenFrequencia`, `frequenciaAberta`, `frequenciaAbertaEm`, `frequenciaFechadaEm`
- [ ] `ConteudoParticipante`: `presenteEm`, `presencaOrigem`
- [ ] Backfill `token_frequencia` único para linhas existentes
- [ ] `npx prisma migrate deploy` + `prisma generate`

### Task 2: Backend services + API

**Files:**
- Modify: `backend/src/services/conteudo.service.ts`
- Modify: `backend/src/controllers/conteudo.controller.ts`
- Modify: `backend/src/routes/conteudo-admin.routes.ts`
- Modify: `backend/src/routes/conteudo-public.routes.ts`
- Modify: `backend/src/routes/medico.routes.ts`
- Modify: `backend/src/middleware/validation.middleware.ts`

- [ ] `abrirFrequenciaAdminService` / `fecharFrequenciaAdminService`
- [ ] Expor `linkFrequencia`, `frequenciaAberta`, contadores em `formatEventoAdmin`
- [ ] `listParticipantes`: incluir `presenteEm`, `presencaOrigem`
- [ ] `confirmarPresencaMedicoService`
- [ ] `getPublicFrequenciaService` / `submitPublicFrequenciaService` (e-mail lowercased)
- [ ] `formatEventoPublico` / get médico: `frequenciaAberta`, `presenteEm`
- [ ] Controllers + rotas + `validatePublicFrequenciaForm` (email)

### Task 3: Frontend API + páginas

**Files:**
- Modify: `frontend/src/modules/conteudos/api/conteudo.service.ts`
- Modify: `frontend/src/modules/conteudos/pages/ConteudosAdminPage.tsx`
- Modify: `frontend/src/modules/conteudos/pages/ConteudoMedicoDetalhePage.tsx`
- Create: `frontend/src/modules/conteudos/pages/ConteudoFrequenciaPublicPage.tsx`
- Modify: `frontend/src/modules/conteudos/index.ts`
- Modify: `frontend/src/App.tsx`

- [ ] Métodos admin abrir/fechar; médico `confirmarPresenca`; público get/submit frequência
- [ ] Bloco Frequência no admin + badge Presente na lista
- [ ] CTA confirmar presença no detalhe médico
- [ ] Página pública + rota

### Task 4: Contexto

- [ ] Atualizar `contexto/17-conteudos-eventos.md` e `mapa-de-bordo.md`
- [ ] Marcar spec como aprovada/implementada
