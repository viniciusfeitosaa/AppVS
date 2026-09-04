# 04 — Autenticação e acessos

**Status:** ✅ Implementado  
**Última atualização:** 2026-09-04

## Escopo entregue

- Login por e-mail, login médico, login master
- Cadastro público e fluxo de convite (`/ativar-conta/:token`)
- Esqueci / redefinir senha (`ResetSenhaToken`)
- JWT + refresh (ver `jwt.util.ts`, env `JWT_*`)
- Sessões persistidas (`Sessao`, `SessaoMaster`)
- Middleware `auth.middleware.ts` — validação de token e papel
- Controle fino por **módulo** (`requireModuleAccess`, `acesso-modulo.service.ts`)
- **Perfis de acesso staff** — `PerfilAcesso` + níveis `OFF` / `VER` / `EDITAR` por `ModuloSistema` (2026-08-14)
- Rate limiting global em `/api`

## Rotas (`/api/auth`)

Arquivo: `backend/src/routes/auth.routes.ts`

- `POST /login` — e-mail/senha (admin)
- `POST /login-medico` — fluxo médico
- `POST /login-master` — master
- Cadastro, refresh, logout, reset (ver controllers em `auth.controller.ts`)

## Frontend

| Arquivo | Função |
|---------|--------|
| `frontend/src/context/AuthContext.tsx` | Estado global de auth |
| `frontend/src/services/auth.service.ts` | Chamadas API; `hasAccess`, `canEdit`, `isAdminPleno` |
| `frontend/src/services/api.ts` | Axios; 403 de módulo **não** redireciona a `/acesso-negado` |
| `frontend/src/components/Layout/ProtectedRoute.tsx` | Rotas autenticadas |
| `frontend/src/components/Layout/AppShell.tsx` | Menu filtrado por nível (Off **oculto**) |
| `frontend/src/hooks/useModuloNivel.ts` | Hook `canEdit` / `hasAccess`; **OFF até carregar** (não otimista) |
| `frontend/src/pages/Login.tsx` | Tela de login (sem vídeo animado — removido em 2026) |
| `frontend/src/pages/PerfisEquipe.tsx` | CRUD perfis e usuários staff (admin pleno) |

## Papéis

```prisma
enum UserRole {
  MASTER
  MEDICO
}
```

Staff (ex.: escalista) continua em `UsuarioMaster` com login master; permissões vêm do **perfil customizado**, não de novo valor no enum.

## Perfis de acesso staff (2026-08-14)

### Modelo

```prisma
enum NivelAcessoModulo {
  OFF
  VER
  EDITAR
}

model PerfilAcesso { ... modulos PerfilAcessoModulo[]; usuarios UsuarioMaster[] }
model PerfilAcessoModulo { perfilAcessoId; modulo ModuloSistema; nivel NivelAcessoModulo }

// UsuarioMaster.perfilAcessoId String? — null = administrador pleno
```

**Migration:** `backend/prisma/migrations/20260814210000_perfil_acesso_staff/`

### Conceitos

| Conceito | Comportamento |
|----------|---------------|
| Admin pleno | `UsuarioMaster.perfilAcessoId = null` — todos os módulos `EDITAR` + gerencia perfis/usuários |
| Staff com perfil | `perfilAcessoId` preenchido — grade do perfil define menu e API |
| Nível por módulo | `OFF` (oculto) \| `VER` (leitura) \| `EDITAR` (mutações) |
| Login bloqueado | Usuário `ativo=false` ou perfil `ativo=false` |

### Regras duras

- Só **admin pleno** cria/edita perfis e usuários staff (`requireAdminPleno`)
- Perfil customizado **não** pode ter `CONFIGURACOES = EDITAR` (serviço força no máximo `VER`)
- Em todo perfil staff, `PERFIL` fica no mínimo `VER` (Minha Conta / troca de senha)
- Matriz `AcessoModuloPerfil` MASTER/MEDICO permanece para médicos; **não** é fonte de verdade do staff

### Middleware

| Guard | Função |
|-------|--------|
| `requireModuleAccess(modulo)` | Nível ≥ `VER` |
| `requireModuleWrite(modulo)` | Nível = `EDITAR` (v1: rotas mutáveis de **ESCALAS**) |
| `requireAdminPleno()` | Apenas `perfilAcessoId = null` |

Resolução de níveis: `getNiveisModuloUsuarioService` em `acesso-modulo.service.ts`.

### API admin (admin pleno)

| Método | Rota | Função |
|--------|------|--------|
| GET/POST | `/api/admin/perfis-acesso` | listar / criar perfil |
| GET/PUT/PATCH | `/api/admin/perfis-acesso/:id` | detalhe / atualizar (incl. ativo) |
| GET/POST | `/api/admin/usuarios-staff` | listar / criar staff |
| PUT/PATCH | `/api/admin/usuarios-staff/:id` | atualizar (perfil, ativo, senha) |

Controllers: `perfil-acesso.controller.ts`, `usuario-staff.controller.ts`  
Services: `perfil-acesso.service.ts`, `usuario-staff.service.ts`

Sessão / `GET` modulos-acesso expõe `mapNiveis`, `isAdminPleno` e `perfilAcessoId`.

### UI

- Rota `/perfis-equipe` — menu Administração, **somente admin pleno**; abas Perfis \| Usuários
- Menu e dashboard: módulo visível se nível ≥ `VER`
- Ações de escrita (criar/editar/excluir): UI + API só com `EDITAR`
- **Escalas v1:** `Escalas.tsx`, `SubgruposEquipes.tsx`, `TiposPlantaoContratoPanel.tsx` respeitam `ESCALAS=VER` (somente leitura)

### Gate pós-implementação

- Testes Jest: `acesso-modulo-niveis.service.test.ts`, `auth.middleware.test.ts`, `perfil-acesso.service.test.ts`, `usuario-staff.service.test.ts`
- Estender `requireModuleWrite` aos demais módulos conforme perfis reais (v1.1)

## Módulos do sistema

Enum `ModuloSistema` + matriz em `AcessoModuloPerfil`.  
Defaults em `backend/src/constants/modulos.const.ts`.

Endpoints admin (matriz histórica MASTER/MEDICO):

- `GET /api/admin/acessos-modulos` — matriz MASTER/MEDICO (acesso ≥ VER em CONFIGURACOES)
- `PUT /api/admin/acessos-modulos` e `POST /api/admin/push/broadcast` — **somente admin pleno** (`requireAdminPleno`)

## Segurança

- Senhas: bcrypt (`BCRYPT_ROUNDS`)
- Validação: `express-validator` + `validation.middleware.ts`
- Auditoria de ações sensíveis: `auditoria.service.ts`

## O que não refazer

- Não expor `uploads/` estaticamente — já removido; usar rotas de download autenticadas
- CORS já inclui `sejavivasaude.com.br` e localhost 3000/5173

## Changelog

### 2026-09-04 — Login Escalista sem acesso-negado + GETs Escalas
- `useModuloNivel`: enquanto não carrega permissões → OFF / sem acesso (evita chamar APIs Off no Dashboard)
- Interceptor: 403 com “módulo/permissão” não faz `window.location` para `/acesso-negado`
- AppShell/Dashboard: menu e atalhos só VER/EDITAR (sem flash Off)
- `requireAnyModuleAccess`: GETs de contratos-ativos, subgrupos, equipes, médicos aceitam **ESCALAS**; CRUD equipe + add/remove médico na equipe idem
- Arquivos: `useModuloNivel.ts`, `api.ts`, `AppShell.tsx`, `Dashboard.tsx`, `admin.routes.ts`

### 2026-09-04 — Menu oculta módulos Off
- AppShell: não libera itens até carregar `modulos-acesso`; só VER/EDITAR no menu (desktop/mobile/Mais)
- Dashboard: atalhos e alerta de justificativas filtrados pelo nível do perfil
- Arquivos: `AppShell.tsx`, `Dashboard.tsx`

### 2026-08-14 — Perfis de acesso e equipe staff
- `PerfilAcesso` + `NivelAcessoModulo` OFF/VER/EDITAR; `UsuarioMaster.perfilAcessoId` (null = pleno)
- APIs `/admin/perfis-acesso`, `/admin/usuarios-staff` com `requireAdminPleno`
- `requireModuleWrite` em rotas mutáveis de ESCALAS; login bloqueia usuário/perfil inativo
- Front: `/perfis-equipe`, `hasAccess`/`canEdit`, Escalas/Subgrupos só leitura se VER
- Regras: sem CONFIGURACOES=EDITAR em perfis custom; PERFIL ≥ VER
- Gate segurança: mutações CONFIGURACOES (matriz + broadcast) só admin pleno; `requireModuleWrite` nos demais módulos = v1.1
- Arquivos: `acesso-modulo.service.ts`, `auth.middleware.ts`, `perfil-acesso.*`, `usuario-staff.*`, `PerfisEquipe.tsx`, `useModuloNivel.ts`, `Escalas.tsx`, `SubgruposEquipes.tsx`
- Migration: `20260814210000_perfil_acesso_staff`
- Design: `docs/superpowers/specs/2026-08-14-perfis-acesso-staff-design.md`

## Pendências

- [ ] Estender `requireModuleWrite` aos demais módulos além de ESCALAS (v1.1)
- [ ] Revisar se `CHECKLIST` de “Fase 2 Autenticação” pode ser arquivado
- [x] Migration `20260814210000_perfil_acesso_staff` na VPS + perfil Escalista (menu Off + login ok 2026-09-04); smoke VER vs EDITAR nas telas ainda útil
- [ ] Migration `20260815223000_fix_modulo_vagas_enum` na VPS (repara VAGAS se ausente no enum)
