# Task 6 Report — Frontend permissões (Auth + AppShell)

**Branch:** `feat/perfis-acesso-staff`  
**Data:** 2026-08-14  
**Status:** DONE

## Objetivo

Tipar resposta de `/auth/modulos-acesso`, expor `hasAccess` / `canEdit` / `isAdminPleno` e item de menu **Perfis e equipe** só para admin pleno.

## Alterações

### `frontend/src/constants/modulos.ts`
- Tipo `NivelAcessoModulo` = `OFF | VER | EDITAR`

### `frontend/src/services/auth.service.ts`
- `ModulosAcessoData`: `{ perfil, map, mapNiveis?, isAdminPleno?, items? }`
- Helpers: `nivelDeModulo`, `hasAccess`, `canEdit`, `isAdminPleno`
- Compat: sem `mapNiveis`, `map[m]=true` → EDITAR; `false` → OFF

### `frontend/src/context/AuthContext.tsx`
- Reexporta helpers de permissão

### `frontend/src/components/Layout/AppShell.tsx`
- Menu filtra com `hasAccess` (mapa/níveis); loading mantém menu aberto
- Item **Perfis e equipe** → `/perfis-equipe` só se `isAdminPleno`
- Reexporta helpers; preserva WIP local (“Perfil Administrador”)

## Commit

`feat(auth): hasAccess/canEdit e menu Perfis e equipe`

## Handoff

Task 7: página `PerfisEquipe` + rota `/perfis-equipe` + clients admin.
