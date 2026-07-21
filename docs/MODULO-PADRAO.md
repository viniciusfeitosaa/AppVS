# Padrão de módulos no AppVS

Referência implementada em **Painel de E-mail** (`ENVIO_EMAIL`).

## Backend

```
backend/src/modules/<nome>/
  <nome>.service.ts      # regras de negócio + Prisma
  <nome>.controller.ts   # HTTP handlers
backend/src/routes/<nome>.routes.ts   # Router Express + auth + requireModuleAccess
backend/src/utils/       # utilitários compartilhados (ex.: email-delivery.util.ts)
```

1. Adicionar valor em `enum ModuloSistema` (`schema.prisma` + migration).
2. Registrar em `constants/modulos.const.ts` (`MODULOS_SISTEMA` + defaults por perfil).
3. Montar rota em `app.ts`: `app.use('/api/<nome>', <nome>Routes)`.
4. Proteger com `authenticateToken` + `requireModuleAccess(ModuloSistema.X)`.

## Frontend

```
frontend/src/modules/<nome>/
  types.ts
  index.ts
  api/<nome>.service.ts
  components/...
  pages/<Nome>Page.tsx
```

1. Atualizar `constants/modulos.ts` (tipo + `MODULO_LABEL`).
2. Rota em `App.tsx` (`/email` → página do módulo).
3. Menu em `AppShell.tsx` (`moduloByRoute` + item no grupo adequado).
4. Checagem de acesso na página via `authService.getModulosAcesso()`.

## Banco

- Tabelas do módulo com `tenantId` e índices por tenant.
- Migration em `prisma/migrations/YYYYMMDDHHMMSS_descricao/`.

## Permissões

- Master: habilitado por padrão (exceto `CORE_MASTER_SEMPRE_ATIVOS`).
- Médico: desabilitado por padrão; liberar em **Minha Conta → Matriz de acessos**.
