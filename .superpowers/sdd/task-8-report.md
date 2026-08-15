# Task 8 Report — Escalas / Subgrupos UI só leitura se VER

**Branch:** `feat/perfis-acesso-staff`  
**Data:** 2026-08-14  
**Status:** DONE

## Objetivo

Quando o staff tem `ESCALAS=VER` (sem `EDITAR`), esconder/desabilitar CTAs de criar/editar/excluir/mutar; GETs e navegação de leitura seguem.

## Alterações

### `frontend/src/hooks/useModuloNivel.ts` (novo)
- Reusa query `['auth', 'modulos-acesso', userId]`
- Expõe `canEdit` / `hasAccess` / `nivel` / `isAdminPleno`
- Enquanto carrega, assume EDITAR (mesmo padrão do AppShell)

### `frontend/src/pages/Escalas.tsx`
- `podeEditarEscalas = useModuloNivel('ESCALAS').canEdit`
- Grade forçada a só leitura se `!podeEditarEscalas`
- CTAs: Nova/Editar/Excluir escala, Replicar, Publicar, membros, adicionais, tipos, links de criar

### `frontend/src/pages/SubgruposEquipes.tsx`
- Mesmo gate nos forms Criar subgrupo/equipe/escala, Excluir, membros, estilo de produção

### `frontend/src/components/TiposPlantaoContratoPanel.tsx`
- Prop `readOnly` oculta criar/editar/excluir tipos

## Commit

`feat(auth): UI Escalas/Subgrupos só leitura sem EDITAR`

## Handoff

Task 9: docs contexto (`04`, `15`, persona staff).
