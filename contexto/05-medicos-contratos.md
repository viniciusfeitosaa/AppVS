# 05 — Médicos e contratos

**Status:** ✅ Implementado  
**Última atualização:** 2026-09-01

## Médicos

### Backend

- `medico.service.ts`, rotas em `admin.routes.ts` e `medico.routes.ts`
- CRUD médicos (MASTER com módulo `MEDICOS`)
- Status: `StatusCadastroMedico` (pendente, ativo, rejeitado)
- Convite: `POST /api/admin/medicos/:id/invite`
- Documentos de perfil: `MedicoDocumento`, tipos em `DocumentoPerfilTipo`

### Frontend

- `pages/Medicos.tsx` — listagem/gestão; banner do selecionado com **Dados do profissional**, **Histórico de pontos** e **WhatsApp** (`wa.me` no telefone cadastrado)
- `pages/Avaliacao.tsx` — fila de cadastros pendentes; botão **Busca médicos (CFM)** abre o portal (sem pré-preenchimento)
- `pages/Perfil.tsx` — perfil do usuário logado
- `pages/AcceptInvite.tsx` — ativação de conta

## Contratos ativos

Vinculam subgrupos e equipes ao contrato institucional.

| Entidade | Relação |
|----------|---------|
| `ContratoAtivo` | Contrato principal |
| `ContratoSubgrupo` | N:N contrato ↔ subgrupo |
| `ContratoEquipe` | N:N contrato ↔ equipe |

### Rotas admin (exemplos)

- `GET/POST/PUT/DELETE /api/admin/contratos-ativos`
- Sub-recursos `/contratos-ativos/:id/subgrupos` e `/equipes`

### Frontend

- `pages/ContratosAtivos.tsx`

## Subgrupos e equipes

- `grupo-equipe.service.ts`, `grupo-equipe.controller.ts`
- `pages/SubgruposEquipes.tsx`
- Associação médico ↔ equipe/subgrupo: `EquipeMedico`, `SubgrupoMedico`

## Multi-tenant

- `Tenant` no schema; médicos e masters associados ao tenant
- `MasterEscopoContext` no front — escopo de visualização para MASTER

## Pendências

- [x] Documentar regras de negócio de aprovação de cadastro pendente (se houver UI específica)

Fila Master em `/avaliacao`: pendentes de `/cadastro` público. **Aprovar** → `ATIVO`; **Rejeitar** → `REJEITADO`. Botão **Busca médicos (CFM)** abre `portal.cfm.org.br/busca-medicos` (consulta manual).

## Changelog

### 2026-09-01 — Filtros avançados no Corpo Clínico
- Chips (Todos, Ativos, Inativos, Sem equipe, Novos 7d/30d) + avançado (equipe, profissão, período de cadastro)
- API: `GET /admin/medicos/filtros-resumo`; query params em `listMedicos`
- Arquivos: `Medicos.tsx`, `admin.service.ts` (front/back)

### 2026-08-19 — Avaliação: CFM só abre o portal
- Removidos pré-preenchimento, página intermediária `cfm-prefill` e atalho/userscript. O botão **Busca médicos (CFM)** só abre o site oficial.
- Arquivos: `frontend/src/pages/Avaliacao.tsx`

### 2026-08-19 — WhatsApp do profissional selecionado
- Banner em `Medicos.tsx`: botão **WhatsApp** abre `wa.me` com DDI 55 a partir do telefone cadastrado; desabilitado se o número for inválido ou ausente
- Arquivos: `frontend/src/pages/Medicos.tsx`, `frontend/src/utils/whatsapp.ts`

### 2026-08-19 — Dados do profissional selecionado
- Banner em `Medicos.tsx`: botão **Dados do profissional** abre ficha completa (contato, endereço, bancários, termos, equipes, documentos com download)
- API: `GET /api/admin/medicos/:id` e download de documento de perfil
- Arquivos: `Medicos.tsx`, `admin.service.ts`, `admin.controller.ts`, `admin.routes.ts`
