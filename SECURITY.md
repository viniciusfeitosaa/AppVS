# Padrão de Segurança (Restrito) — AppVS

Este documento define **o padrão obrigatório de segurança** para o AppVS.
O objetivo é garantir que qualquer nova feature mantenha o app seguro, mesmo sob inputs maliciosos e condições de concorrência.

## Escopo

- **Backend** (Express + Prisma + PostgreSQL): fonte de verdade de validação e autorização.
- **Frontend**: nunca é considerado confiável (pode ser alterado/forjado).
- **Integrações** (SMTP/WhatsApp/Resend, etc.): tratadas como externas e falháveis.

## Princípios inegociáveis

- **Nunca confiar no frontend**: tudo deve ser validado e normalizado no backend.
- **Fail closed**: em dúvida, negar a requisição (4xx) e não “tentar adivinhar”.
- **Menor privilégio**: roles/permissões por módulo devem ser aplicadas no backend.
- **Atomicidade**: qualquer fluxo com múltiplas escritas no banco deve ser transacional.
- **Idempotência quando possível**: evitar duplicações por retry/conexões instáveis.
- **Sem dados sensíveis em logs**: não logar senhas/tokens/headers de auth.

---

## O que foi implementado (mar/2026)

### 1) Validação server-side (Express Validator)

Foram adicionadas validações explícitas para entradas críticas e parâmetros:

- **Ponto**
  - `POST /api/ponto/checkin`: valida `escalaId?`, `observacao?`, `latitude?`, `longitude?`
  - `POST /api/ponto/checkout`: valida `observacao?`, `latitude?`, `longitude?`
- **Admin / Escalas**
  - `POST /api/admin/escalas`: valida `nome`, `contratoAtivoId`, `descricao?`, `dataInicio`, `dataFim`, `ativo?`
  - `PUT /api/admin/escalas/:id`: valida `:id` e payload opcional
  - `DELETE /api/admin/escalas/:id`: valida `:id`
  - `POST /api/admin/escalas/:id/plantoes`: valida `:id` e payload (`data`, `gradeId`, `medicoId`, `valorHora?`)
  - `DELETE /api/admin/escalas/:id/plantoes/:plantaoId`: valida `:id` e `:plantaoId`
  - `POST /api/admin/escalas/:id/medicos`: valida `:id` e payload (`medicoId`, `cargo?`, `valorHora?`)
  - `DELETE /api/admin/escalas/:id/medicos/:medicoId`: valida `:id` e `:medicoId`
- **Admin / Convites**
  - `POST /api/admin/medicos/:id/invite`: valida `:id`

Arquivos principais:
- `backend/src/middleware/validation.middleware.ts`
- `backend/src/routes/admin.routes.ts`
- `backend/src/routes/ponto.routes.ts`

### 2) Hardening dos controllers (normalização/casting)

Mesmo com validação, controllers foram reforçados para não depender de tipos vindos do frontend:

- **Escalas**: conversão segura de `ativo` (`true/false` boolean ou string) antes de chamar service.
- **Alocação**: conversão segura de `valorHora` para `Number(...)` e passagem explícita de campos (evita `...req.body` em fluxos críticos).

Arquivo:
- `backend/src/controllers/admin.controller.ts`

### 3) Transações Prisma (atomicidade)

Foram aplicadas transações (`prisma.$transaction`) nos fluxos críticos para evitar estados inconsistentes:

- **Convites**
  - Aceitar convite: update do médico + criação de sessão + auditoria (tudo atômico)
  - Gerar convite: update do token + auditoria (atômico)
- **Cadastro público**
  - Criação do médico + auditoria (atômico)
- **Reset de senha**
  - Consumo do token + update da senha + remoção do token (atômico)
- **Escalas**
  - Create/update/delete escala + auditoria (atômico)
  - Alocar/remover médico + auditoria (atômico)
  - Criar/remover plantão + auditoria (atômico)
- **Ponto**
  - Check-in: criação do registro + auditoria (atômico) e **revalidação dentro da transação** para reduzir race condition
  - Checkout: update protegido (`updateMany` com `checkOutAt: null`) + auditoria (atômico)

Arquivos:
- `backend/src/services/auth.service.ts`
- `backend/src/services/admin.service.ts`
- `backend/src/services/ponto.service.ts`

### 4) Auditoria transacional (quando desejado)

`createAuditLog` passou a aceitar um client Prisma opcional (TransactionClient), para que auditoria possa fazer parte da mesma transação quando necessário.

Arquivo:
- `backend/src/services/auditoria.service.ts`

---

## Padrão Restrito a seguir (obrigatório)

### A) Validação e normalização de entrada

- **Obrigatório** para qualquer endpoint que recebe:
  - `req.body`, `req.params`, `req.query`
  - IDs (UUID) e datas
  - números monetários (`valorHora`, etc.)
  - geolocalização (`latitude/longitude`)
- **Nunca** confiar em:
  - tipos vindos do cliente (ex.: `"true"`/`"false"`, números em string)
  - campos a mais no `body` (tentativas de sobrescrever campos)

**Regras**
- **Param UUID**: sempre validar com `validateUUIDParam('id')` (ou equivalente).
- **Datas**: `isISO8601()` e converter com `new Date(...)` no service.
- **Números**: validar com `isFloat()` / limites; converter com `Number()` e rejeitar `NaN`.
- **Strings**: `trim()`, limites de tamanho, bloquear valores vazios quando obrigatório.

**Anti-padrão proibido**
- `...req.body` em fluxos sensíveis sem whitelisting explícito.

### B) Autenticação e autorização

- **Sempre aplicar** `authenticateToken` para rotas privadas.
- **Sempre aplicar** role e permissão por módulo:
  - Master: `requireRole([MASTER])`
  - Médico: `requireRole([MEDICO])`
  - Módulos: `requireModuleAccess(ModuloSistema.X)`

**Regras**
- Nunca confiar em `role`/`tenantId` vindos do body/query.
- `tenantId` deve vir do token (via `req.user`) e ser usado em **todas** as queries Prisma.

### C) Prisma e acesso ao banco (seguro por padrão)

**Obrigatório usar transação** quando houver:
- mais de uma escrita (create/update/delete) no fluxo
- escrita + auditoria
- escrita + criação de sessão
- escrita + consumo de token
- qualquer fluxo que possa sofrer retry/concorrrência (check-in, convites, reset)

**Padrão**
- Preferir:
  - `return prisma.$transaction(async (tx) => { ... })`
  - Passar `tx` para funções internas (incluindo auditoria) quando fizer sentido.
- Para evitar race:
  - usar updates condicionais (`updateMany` com filtro) e checar `count`
  - revalidar invariantes dentro da transação quando necessário

### D) Erros e respostas

- Para validação: retornar **400** com `errors` (lista).
- Para auth: **401** (não autenticado) e **403** (sem permissão).
- Para conflito: **409** (ex.: check-in já aberto).
- Para não encontrado: **404**.
- Para erro inesperado: **500** sem detalhes internos em produção.

### E) Logs e dados sensíveis

- Nunca logar:
  - `password`, `novaSenha`, `confirmPassword`
  - tokens (`Authorization`, `accessToken`, `refreshToken`, tokens de reset/invite)
- Para troubleshooting:
  - mascarar e-mails/identificadores quando necessário
  - preferir logs com IDs internos (UUID) sem payload completo

### F) Upload de arquivos

Padrão mínimo (obrigatório quando houver upload):
- `fileFilter` (MIME + extensão permitidas)
- limite de tamanho
- salvar fora de diretórios executáveis
- nunca confiar no `originalname` (sanitizar)

> Observação: se upload ainda não tiver `fileFilter`, isso deve ser tratado como **pendência de segurança**.

### G) CORS / Headers / Rate limit

- Manter `helmet()` ativo.
- Manter CORS com allowlist (sem `*` em produção).
- Manter rate limit global e, para endpoints sensíveis, considerar rate limit específico:
  - login
  - reset de senha
  - accept-invite

### H) Secrets e configuração

- Secrets somente via `.env` (não comitar).
- `JWT_SECRET` e `JWT_REFRESH_SECRET` devem ter alta entropia.
- Rotacionar secrets se houver suspeita de vazamento.

---

## Checklist de PR (obrigatório)

Para qualquer alteração backend:

- [ ] Inputs validados (body/params/query) com limites e formatos
- [ ] Campos normalizados (`trim`, lower-case e-mail, Number, Date)
- [ ] Autorização aplicada (role + módulo quando aplicável)
- [ ] Queries Prisma sempre filtrando por `tenantId`
- [ ] Fluxos com múltiplas escritas usam `prisma.$transaction`
- [ ] Proteção contra race/retry (quando aplicável)
- [ ] Sem secrets/logs sensíveis
- [ ] Smoke test básico ou teste automatizado cobrindo o caminho

---

## Referências de implementação (arquivos)

- Validações: `backend/src/middleware/validation.middleware.ts`
- Rotas: `backend/src/routes/admin.routes.ts`, `backend/src/routes/ponto.routes.ts`
- Services transacionais: `backend/src/services/auth.service.ts`, `backend/src/services/admin.service.ts`, `backend/src/services/ponto.service.ts`
- Auditoria: `backend/src/services/auditoria.service.ts`

