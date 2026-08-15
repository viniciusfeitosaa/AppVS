# Task 7 Report — Página PerfisEquipe + rotas App

**Branch:** `feat/perfis-acesso-staff`  
**Data:** 2026-08-14  
**Status:** DONE

## Objetivo

Entregar UI `/perfis-equipe` (abas Perfis | Usuários), clients admin e guard para admin pleno.

## Alterações

### `frontend/src/services/admin.service.ts`
- Tipos `PerfilAcesso*` / `UsuarioStaff*`
- Clients: `list/create/update` perfis-acesso e usuarios-staff

### `frontend/src/pages/PerfisEquipe.tsx`
- Abas Perfis | Usuários; modais criar/editar
- Grade Off/Ver/Editar (CONFIGURACOES sem Editar; PERFIL ≥ Ver)
- Badge Administrador se `perfilAcessoId == null`
- Guard: `!isAdminPleno` → mensagem acesso restrito

### `frontend/src/App.tsx`
- Rota lazy `/perfis-equipe` com `MasterOnly` + Suspense

### `frontend/src/components/Layout/AppShell.tsx`
- Menu `/perfis-equipe` filtrado só por `isAdminPleno` (sem módulo)
- Redirect `/acesso-negado` se rota aberta sem pleno

## Commit

`feat(auth): página Perfis e equipe`

## Handoff

Task 8: UI Escalas/Subgrupos só leitura quando `!canEdit('ESCALAS')`.
