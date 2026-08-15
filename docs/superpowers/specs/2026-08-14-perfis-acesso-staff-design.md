# Design: Perfis de acesso e equipe staff (escalista etc.)

**Data:** 2026-08-14  
**Status:** aprovado (2026-08-14)  
**Etapa contexto:** `04-autenticacao-acessos.md`

## Problema

Hoje só existem `MASTER` e `MEDICO`. Todo MASTER do tenant enxerga a mesma matriz de módulos. Não há como criar contas de staff (ex.: escalista) com e-mail/senha e liberar só Escalas (ou outros módulos), com nível **ver** ou **editar**.

## Decisões de produto (aprovadas)

| Decisão | Escolha |
|---------|---------|
| Tipo de conta | Staff com e-mail/senha (como admin), não médico |
| Perfis | Livres: MASTER monta nome + módulos |
| Nível por módulo | `OFF` \| `VER` \| `EDITAR` |
| Escopo de dados | Tenant inteiro (fase 2: contrato/equipe) |
| Abordagem técnica | Perfis customizados + usuários ligados a um perfil |

## Conceitos

### Perfil de acesso
- Nome (ex.: Escalista), descrição opcional, ativo/inativo
- Grade: para cada `ModuloSistema`, nível `OFF` | `VER` | `EDITAR`

### Usuário staff
- Continua em `UsuarioMaster` (mesmo login master)
- `perfilAcessoId` opcional:
  - `null` → **administrador pleno** (tudo + gerencia perfis/usuários)
  - preenchido → restrições do perfil

### Regras duras
- Só administrador pleno cria/edita perfis e usuários staff
- Perfil customizado **não** pode ter `CONFIGURACOES = EDITAR`
- Em todo perfil staff, `PERFIL` fica no mínimo `VER` (Minha Conta / troca de senha própria); o MASTER pode elevar a `EDITAR` se o módulo tiver mutações relevantes
- Usuário inativo ou perfil inativo → login bloqueado
- Médicos (`MEDICO`) e a matriz MASTER/MEDICO em Minha Conta **não** mudam de papel; staff resolve permissões pelo **perfil customizado**

### Implementação de `requireModuleWrite` (faseada)
1. **v1:** Auth + menu + CRUD perfis/usuários + enforcement VER/EDITAR nas rotas do módulo **ESCALAS** (e rotas front ligadas: `/escalas`, `/subgrupos-equipes`)
2. **v1.1:** Estender `requireModuleWrite` aos demais módulos conforme forem liberados em perfis reais (Valores, Relatórios, etc.) — mesmo padrão, sem redesenho

## UI

### Rota
- `/perfis-equipe` — menu Administração, **somente admin pleno**
- Título: **Perfis e equipe**
- Abas: **Perfis** | **Usuários**

### Aba Perfis
- Lista: nome, nº de usuários, ativo
- Criar/editar: nome, descrição, grade Off/Ver/Editar por módulo
- Desativar perfil (soft)

### Aba Usuários
- Lista: nome, e-mail, perfil (ou “Administrador”), ativo
- Criar: nome, e-mail, senha inicial, perfil
- Editar: nome, perfil, ativo; troca/reset de senha
- Contas plenas (`perfilAcessoId = null`) marcadas como Administrador

### Menu e telas
- Itens de menu: módulo com nível ≥ `VER`
- Ações de escrita (criar/editar/excluir): só se nível = `EDITAR` (UI); API reforça
- Dashboard: só atalhos dos módulos permitidos (se Dashboard ≥ VER)

## Modelo de dados

```prisma
enum NivelAcessoModulo {
  OFF
  VER
  EDITAR
}

model PerfilAcesso {
  id          String   @id @default(uuid())
  tenantId    String
  nome        String
  descricao   String?
  ativo       Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  modulos     PerfilAcessoModulo[]
  usuarios    UsuarioMaster[]
  @@unique([tenantId, nome])
}

model PerfilAcessoModulo {
  id             String
  perfilAcessoId String
  modulo         ModuloSistema
  nivel          NivelAcessoModulo
  @@unique([perfilAcessoId, modulo])
}

// UsuarioMaster: + perfilAcessoId String? (FK opcional)
```

## API (rascunho)

Prefixo admin, guard: **apenas admin pleno**.

| Método | Rota | Função |
|--------|------|--------|
| GET/POST | `/admin/perfis-acesso` | listar / criar |
| GET/PUT/PATCH | `/admin/perfis-acesso/:id` | detalhe / atualizar (incl. ativo) |
| GET/POST | `/admin/usuarios-staff` | listar / criar staff |
| PUT/PATCH | `/admin/usuarios-staff/:id` | atualizar (perfil, ativo, senha) |

Auth / sessão:
- Login master inclui `perfilAcessoId` e mapa `{ [ModuloSistema]: NivelAcessoModulo }` (pleno = todos EDITAR + flag `isAdminPleno`)
- `GET` “minhas permissões” passa a expor níveis (não só boolean), para o front
- `requireModuleAccess(modulo)` → nível ≥ VER
- `requireModuleWrite(modulo)` → nível = EDITAR (rotas mutáveis relevantes, começando por Escalas e expandindo pelos módulos liberáveis)

## Migração / compatibilidade

- Masters existentes: `perfilAcessoId = null` (plenos)
- Matriz `AcessoModuloPerfil` MASTER/MEDICO permanece para médicos e defaults históricos; **não** é a fonte de verdade do staff com perfil

## Fora de escopo (fase 2)

- Escopo por contrato/equipe
- Convite por e-mail dedicado a staff (reutilizar reset de senha master se já existir)
- Novos papéis no enum `UserRole` por tipo (Escalista etc.)

## Gate pós-implementação (obrigatório)

Quando a feature estiver implementada:

1. **Subagentes** examinam o diff e **criam case tests** (cenários de login, menu, VER vs EDITAR, 403 em escrita, admin pleno vs staff).
2. Rodar esses cases **inline** para detectar e corrigir erros nesta sessão.
3. Subagente(s) com skill **`review-security`** revisam as mudanças (auth, elevação de privilégio, CONFIGURACOES, senhas).

Só então a entrega é considerada fechada para merge/docs finais.

## Critérios de sucesso

- MASTER pleno cria perfil “Escalista” com `ESCALAS = EDITAR` (ou VER) e demais OFF
- Cria usuário staff nesse perfil; login e-mail/senha funciona
- Staff vê só Escalas (e o que foi liberado); sem Perfis e equipe / Configurações editáveis
- Com VER: UI sem mutação; API rejeita POST/PUT/DELETE do módulo
- Com EDITAR: mutações de Escalas permitidas no tenant
- Admin pleno continua com acesso total
