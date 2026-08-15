# Perfis de acesso e equipe staff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o administrador pleno crie perfis livres (ex.: Escalista) com nível OFF/VER/EDITAR por módulo e usuários staff (e-mail/senha) vinculados a esses perfis, com menu e API respeitando o nível.

**Architecture:** `PerfilAcesso` + `PerfilAcessoModulo` + `UsuarioMaster.perfilAcessoId` (null = pleno). `possuiAcessoModulo` / novas helpers resolvem nível por usuário. Front: `/perfis-equipe` + `hasAccess`/`canEdit`. v1 enforça write em ESCALAS.

**Tech Stack:** Prisma/Postgres, Express, Jest, React Query, Vite.

**Spec:** `docs/superpowers/specs/2026-08-14-perfis-acesso-staff-design.md`

## Global Constraints

- Staff = `UsuarioMaster` com `perfilAcessoId` preenchido; pleno = `null`
- Níveis: `OFF` | `VER` | `EDITAR`
- `CONFIGURACOES = EDITAR` proibido em perfil customizado
- `PERFIL` mínimo `VER` em todo perfil staff
- Escopo de dados: tenant inteiro
- Só admin pleno gerencia `/admin/perfis-acesso` e `/admin/usuarios-staff`
- v1 write enforcement: módulo `ESCALAS` (+ rotas front `/escalas`, `/subgrupos-equipes`)
- UI/API em português
- Após implementação: case tests via subagentes + correção inline + `review-security`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/prisma/schema.prisma` + migration | Enum `NivelAcessoModulo`, models, FK em `UsuarioMaster` |
| `backend/src/services/perfil-acesso.service.ts` | CRUD perfil + validação níveis |
| `backend/src/services/perfil-acesso.service.test.ts` | Testes regras de perfil |
| `backend/src/services/usuario-staff.service.ts` | CRUD usuários staff |
| `backend/src/services/usuario-staff.service.test.ts` | Testes staff / pleno |
| `backend/src/services/acesso-modulo.service.ts` | Níveis por userId; `possuiAcesso` ≥ VER; `possuiEscrita` = EDITAR |
| `backend/src/middleware/auth.middleware.ts` | `requireModuleWrite`, `requireAdminPleno`; `req.user` com flags |
| `backend/src/services/auth.service.ts` | Login bloqueia perfil/usuário inativo; payload com níveis |
| `backend/src/controllers/perfil-acesso.controller.ts` | HTTP perfis |
| `backend/src/controllers/usuario-staff.controller.ts` | HTTP usuários |
| `backend/src/routes/admin.routes.ts` | Rotas + write ESCALAS |
| `backend/src/middleware/validation.middleware.ts` | Validators bodies |
| `frontend/src/constants/modulos.ts` | Tipos nível se necessário |
| `frontend/src/context/AuthContext.tsx` | `isAdminPleno`, níveis no user/session |
| `frontend/src/services/auth.service.ts` | Tipagem resposta permissões |
| `frontend/src/services/admin.service.ts` | Clients perfis/usuários |
| `frontend/src/pages/PerfisEquipe.tsx` | UI abas Perfis / Usuários |
| `frontend/src/pages/Escalas.tsx` + `SubgruposEquipes.tsx` | Guardas `canEdit('ESCALAS')` |
| `frontend/src/components/Layout/AppShell.tsx` | Menu por ≥ VER; link Perfis e equipe só pleno |
| `frontend/src/App.tsx` | Rota `/perfis-equipe` |
| `contexto/04-autenticacao-acessos.md` + `15-...` | Docs |

---

### Task 1: Schema Prisma + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/YYYYMMDDHHMMSS_perfil_acesso_staff/migration.sql` (timestamp no momento da criação)

**Produces:** `NivelAcessoModulo`, `PerfilAcesso`, `PerfilAcessoModulo`, `UsuarioMaster.perfilAcessoId`

- [ ] **Step 1: Adicionar enum e models no schema**

```prisma
enum NivelAcessoModulo {
  OFF
  VER
  EDITAR
}

model PerfilAcesso {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  nome      String   @db.VarChar(120)
  descricao String?  @db.Text
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant  Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  modulos PerfilAcessoModulo[]
  usuarios UsuarioMaster[]

  @@map("perfis_acesso")
  @@unique([tenantId, nome])
  @@index([tenantId])
}

model PerfilAcessoModulo {
  id             String            @id @default(uuid())
  perfilAcessoId String            @map("perfil_acesso_id")
  modulo         ModuloSistema
  nivel          NivelAcessoModulo @default(OFF)
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")

  perfil PerfilAcesso @relation(fields: [perfilAcessoId], references: [id], onDelete: Cascade)

  @@map("perfis_acesso_modulos")
  @@unique([perfilAcessoId, modulo])
  @@index([perfilAcessoId])
}
```

Em `UsuarioMaster` adicionar:

```prisma
perfilAcessoId String? @map("perfil_acesso_id")
perfilAcesso   PerfilAcesso? @relation(fields: [perfilAcessoId], references: [id], onDelete: SetNull)
```

Em `Tenant` adicionar `perfisAcesso PerfilAcesso[]`.

- [ ] **Step 2: Criar e aplicar migration**

Run (no diretório `backend`):

```bash
npx prisma migrate dev --name perfil_acesso_staff
```

Expected: migration aplicada; `perfilAcessoId` null nos masters existentes.

- [ ] **Step 3: Commit** (se o usuário pediu commit nesta sessão)

```bash
git add backend/prisma
git commit -m "feat(auth): schema PerfilAcesso e vínculo em UsuarioMaster"
```

---

### Task 2: Serviço de resolução de níveis + testes

**Files:**
- Modify: `backend/src/services/acesso-modulo.service.ts`
- Create: `backend/src/services/acesso-modulo-niveis.service.test.ts` (ou testes no mesmo arquivo `*.test.ts` ao lado)

**Produces:**
- `getNiveisModuloUsuarioService(tenantId, userId, role): { isAdminPleno, map: Record<ModuloSistema, NivelAcessoModulo> }`
- `possuiAcessoModuloUsuarioService` (≥ VER)
- `possuiEscritaModuloUsuarioService` (= EDITAR)
- Atualizar `possuiAcessoModuloService` callers via userId quando MASTER

**Interfaces:**
- Consumes: Prisma `UsuarioMaster.perfilAcessoId` + `PerfilAcessoModulo`
- Produces: funções acima; MEDICO continua na matriz `AcessoModuloPerfil` (boolean → VER/OFF, pleno não se aplica)

- [ ] **Step 1: Escrever testes falhando**

```typescript
describe('niveis modulo usuario', () => {
  it('admin pleno (perfilAcessoId null) tem EDITAR em todos os módulos listados', async () => {
    // mock prisma: master sem perfil
    const r = await getNiveisModuloUsuarioService(tenantId, masterId, UserRole.MASTER);
    expect(r.isAdminPleno).toBe(true);
    expect(r.map.ESCALAS).toBe('EDITAR');
    expect(r.map.CONFIGURACOES).toBe('EDITAR');
  });

  it('staff com ESCALAS=VER e resto OFF: acesso leitura sim, escrita não', async () => {
    const r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);
    expect(r.isAdminPleno).toBe(false);
    expect(await possuiAcessoModuloUsuarioService(tenantId, staffId, UserRole.MASTER, 'ESCALAS')).toBe(true);
    expect(await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, 'ESCALAS')).toBe(false);
  });

  it('staff com perfil inativo ou usuário inativo: sem acesso', async () => {
    // ...
  });
});
```

- [ ] **Step 2: Rodar testes — esperam FAIL**

```bash
cd backend && npx jest src/services/acesso-modulo-niveis.service.test.ts --no-coverage
```

- [ ] **Step 3: Implementar helpers**

Regras:
- Se `role === MEDICO` → mapear boolean da matriz existente para `VER`/`OFF` (`isAdminPleno: false`)
- Se MASTER e `perfilAcessoId == null` → todos `EDITAR`, `isAdminPleno: true`
- Se MASTER com perfil: carregar módulos; faltantes = `OFF`; forçar `PERFIL` ≥ `VER`; se alguém gravou `CONFIGURACOES=EDITAR`, tratar como `VER` na leitura (defesa em profundidade)
- `possuiAcesso` = nível VER ou EDITAR; `possuiEscrita` = EDITAR

Atualizar `possuiAcessoModuloService` **ou** trocar middleware para usar variante com `userId` (preferir: middleware passa `req.user.id`).

- [ ] **Step 4: Testes PASS**

- [ ] **Step 5: Commit** (se pedido)

```bash
git commit -m "feat(auth): resolução de níveis OFF/VER/EDITAR por usuário"
```

---

### Task 3: Middleware requireModuleWrite + requireAdminPleno

**Files:**
- Modify: `backend/src/middleware/auth.middleware.ts`
- Modify: callers de `requireModuleAccess` para MASTER paths que precisam de userId

**Produces:**
- `requireAdminPleno()`
- `requireModuleWrite(modulo)`
- `requireModuleAccess` usa `possuiAcessoModuloUsuarioService(tenantId, id, role, modulo)`

```typescript
export const requireAdminPleno = () => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
  const n = await getNiveisModuloUsuarioService(req.user.tenantId, req.user.id, req.user.role);
  if (!n.isAdminPleno) {
    return res.status(403).json({ success: false, error: 'Apenas administrador pleno pode gerenciar perfis e equipe' });
  }
  return next();
};

export const requireModuleWrite = (modulo: ModuloSistema) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
  const ok = await possuiEscritaModuloUsuarioService(req.user.tenantId, req.user.id, req.user.role, modulo);
  if (!ok) return res.status(403).json({ success: false, error: 'Sem permissão de edição neste módulo' });
  return next();
};
```

- [ ] **Step 1: Implementar middlewares**
- [ ] **Step 2: Em `admin.routes.ts`, nas rotas ESCALAS mutáveis** (POST/PUT/PATCH/DELETE de escalas, plantoes, medicos da escala, subgrupos/equipes da escala, tipos plantão se sob ESCALAS, e rotas de `grupo-equipe` usadas por SubgruposEquipes) **adicionar** `requireModuleWrite(ModuloSistema.ESCALAS)` **além** de `requireModuleAccess(ESCALAS)` (access já garante VER).
- [ ] **Step 3: Smoke manual ou teste de integração mínimo** — staff VER recebe 403 em POST `/admin/escalas`
- [ ] **Step 4: Commit** (se pedido)

---

### Task 4: CRUD PerfilAcesso (service + API + testes)

**Files:**
- Create: `backend/src/services/perfil-acesso.service.ts`
- Create: `backend/src/services/perfil-acesso.service.test.ts`
- Create: `backend/src/controllers/perfil-acesso.controller.ts`
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/middleware/validation.middleware.ts`

**Produces:**
- `listPerfisAcessoService`, `getPerfilAcessoService`, `createPerfilAcessoService`, `updatePerfilAcessoService`
- Rotas com `requireRole(MASTER)` + `requireAdminPleno()`

Validação ao salvar:
- Nome obrigatório, unique no tenant
- Pelo menos um módulo VER ou EDITAR
- Forçar `PERFIL >= VER`
- Rejeitar `CONFIGURACOES === EDITAR` com 400 e mensagem clara
- Grade completa: todos `MODULOS_SISTEMA` (faltantes = OFF)

```typescript
// create payload
{
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  modulos: { modulo: ModuloSistema; nivel: NivelAcessoModulo }[];
}
```

Rotas:
- `GET /admin/perfis-acesso`
- `POST /admin/perfis-acesso`
- `GET /admin/perfis-acesso/:id`
- `PUT /admin/perfis-acesso/:id`

- [ ] **Step 1: Testes** — rejeita CONFIGURACOES EDITAR; força PERFIL VER; create+list
- [ ] **Step 2: Implementar service + controller + routes**
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** (se pedido)

---

### Task 5: CRUD UsuarioStaff + login bloqueios

**Files:**
- Create: `backend/src/services/usuario-staff.service.ts`
- Create: `backend/src/services/usuario-staff.service.test.ts`
- Create: `backend/src/controllers/usuario-staff.controller.ts`
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/services/auth.service.ts` (`loginMasterService` + `loginByEmailService` branch master)

**Produces:** list/create/update staff; login checa perfil ativo

Create:
```typescript
{ nome: string; email: string; senha: string; perfilAcessoId: string; ativo?: boolean }
```

Update:
```typescript
{ nome?: string; perfilAcessoId?: string | null; ativo?: boolean; senha?: string }
```

Regras:
- Email unique no tenant; hash bcrypt igual ao create master existente
- `perfilAcessoId` obrigatório no create (staff); update pode setar `null` só se caller é pleno (promover a admin — exigir confirmação no front, no back permitir com audit log `PROMOVER_ADMIN_PLENO`)
- Não permitir demotar o **último** admin pleno do tenant (contar `perfilAcessoId: null` + ativo)
- Login: se `!ativo` ou (`perfilAcessoId` e `!perfil.ativo`) → 401 com mensagem adequada

Rotas (admin pleno):
- `GET /admin/usuarios-staff`
- `POST /admin/usuarios-staff`
- `PUT /admin/usuarios-staff/:id`

- [ ] **Step 1: Testes** — create staff; login com perfil inativo falha; último pleno não demota
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Atualizar `getMinhaPermissaoModulos` / endpoint auth `GET` permissões para retornar `{ isAdminPleno, mapNiveis, map }` onde `map[m] = nivel !== OFF` (compat front atual)
- [ ] **Step 4: Jest PASS + commit** (se pedido)

---

### Task 6: Frontend — permissões (Auth + AppShell)

**Files:**
- Modify: `frontend/src/services/auth.service.ts` (tipos)
- Modify: `frontend/src/context/AuthContext.tsx` se guardar flags
- Modify: `frontend/src/components/Layout/AppShell.tsx`
- Modify: `frontend/src/constants/modulos.ts` se precisar exportar níveis

**Produces:**
- `hasAccess(modulo)` = nível ≥ VER (usar `map` boolean compat **ou** `mapNiveis`)
- `canEdit(modulo)` = nível === EDITAR (ou `isAdminPleno`)
- `isAdminPleno` do payload
- Menu: item **Perfis e equipe** → `/perfis-equipe` só se `isAdminPleno`
- Filtrar menu com `hasAccess` como hoje

```typescript
const nivel = mapNiveis?.[modulo] ?? (map[modulo] ? 'EDITAR' : 'OFF');
const hasAccess = (m) => isAdminPleno || nivelDe(m) === 'VER' || nivelDe(m) === 'EDITAR';
const canEdit = (m) => isAdminPleno || nivelDe(m) === 'EDITAR';
```

- [ ] **Step 1: Tipar resposta de `/auth/...` permissões** (endpoint existente em `auth.controller` ~linha 156)
- [ ] **Step 2: AppShell — helpers + link menu**
- [ ] **Step 3: Verificar visualmente** login pleno vs (após Task 7) staff
- [ ] **Step 4: Commit** (se pedido)

---

### Task 7: Página PerfisEquipe + rotas App

**Files:**
- Create: `frontend/src/pages/PerfisEquipe.tsx`
- Modify: `frontend/src/services/admin.service.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout/AppShell.tsx` (`moduloByRoute['/perfis-equipe']` — rota só pleno, não precisa módulo; proteger com redirect se `!isAdminPleno`)

**UI:**
- Abas Perfis | Usuários
- Perfis: lista + form modal/drawer com selects Off/Ver/Editar por módulo (labels em PT)
- Usuários: lista + form criar/editar; badge “Administrador” se sem perfil
- Estilo alinhado ao restante (cards viva, btn primary/secondary)

Client API:

```typescript
listPerfisAcesso / createPerfilAcesso / updatePerfilAcesso
listUsuariosStaff / createUsuarioStaff / updateUsuarioStaff
```

- [ ] **Step 1: admin.service methods**
- [ ] **Step 2: Página + rota lazy se o App usar lazy**
- [ ] **Step 3: Guard na página: se `!isAdminPleno` → mensagem acesso restrito**
- [ ] **Step 4: Commit** (se pedido)

---

### Task 8: Escalas / SubgruposEquipes — UI só leitura se VER

**Files:**
- Modify: `frontend/src/pages/Escalas.tsx`
- Modify: `frontend/src/pages/SubgruposEquipes.tsx`
- Opcional: hook `useModuloNivel('ESCALAS')` em `frontend/src/hooks/useModuloNivel.ts`

**Produces:** botões Criar/Editar/Excluir/Adicionar plantão/Tipos mutáveis desabilitados ou ocultos quando `!canEdit('ESCALAS')`; queries GET continuam.

Padrão:
```typescript
const podeEditarEscalas = canEdit('ESCALAS');
// {podeEditarEscalas && <button>Criar...</button>}
```

- [ ] **Step 1: Hook ou props a partir de modulos query**
- [ ] **Step 2: Aplicar nos CTAs principais de Escalas e SubgruposEquipes**
- [ ] **Step 3: Commit** (se pedido)

---

### Task 9: Docs contexto

**Files:**
- Modify: `contexto/04-autenticacao-acessos.md`
- Modify: `contexto/15-estado-atual-e-pendencias.md`
- Modify: `contexto/01-produto-e-visao.md` (persona Escalista/staff — 1 parágrafo)

- [ ] **Step 1: Documentar modelos, rotas, regras, gate de qualidade**
- [ ] **Step 2: Snapshot 15 com data da entrega**

---

### Task 10: Gate pós-implementação (obrigatório)

**Não pular.**

- [ ] **Step 1: Subagente(s) examinam o diff e propõem case tests** cobrindo no mínimo:
  1. Admin pleno cria perfil Escalista (`ESCALAS=EDITAR`) e usuário
  2. Login staff OK; menu só Escalas (+ Perfil)
  3. Staff VER → GET escalas 200; POST 403; UI sem botões de mutação
  4. Staff EDITAR → POST/PUT escalas 200
  5. Staff não acessa `/perfis-equipe` nem POST perfis (403)
  6. Perfil com `CONFIGURACOES=EDITAR` rejeitado na API
  7. Login com perfil inativo falha
  8. Último admin pleno não pode ser demovido

- [ ] **Step 2: Rodar cases inline; corrigir falhas nesta sessão**

- [ ] **Step 3: Lançar subagente `security-review`** (skill review-security / Task `security-review`) no diff da branch — foco: elevação de privilégio, bypass de `requireAdminPleno`, senhas, CONFIGURACOES

- [ ] **Step 4: Aplicar correções de segurança se houver; só então marcar entrega fechada**

---

## Spec coverage checklist

| Spec | Task |
|------|------|
| PerfilAcesso + níveis | 1, 4 |
| UsuarioMaster.perfilAcessoId | 1, 5 |
| Admin pleno vs staff | 2, 3, 5 |
| CONFIGURACOES sem EDITAR | 4 |
| PERFIL ≥ VER | 2, 4 |
| Login inativo | 5 |
| API perfis/usuários | 4, 5 |
| Menu / hasAccess / canEdit | 6 |
| Página Perfis e equipe | 7 |
| Escalas VER/EDITAR UI+API | 3, 8 |
| Docs | 9 |
| Case tests + review-security | 10 |
| Escopo contrato (fase 2) | — fora |

---

## Execution

Plan saved to `docs/superpowers/plans/2026-08-14-perfis-acesso-staff.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — um subagente por task, review entre tasks  
2. **Inline Execution** — executar nesta sessão com checkpoints  

**Which approach?**
