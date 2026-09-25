# 05 — Médicos e contratos

**Status:** ✅ Implementado  
**Última atualização:** 2026-09-14

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
- [ ] **Voltar (placeholders 2026-09-14):** **THALES** e **FREDDY BARBERY** — trocar CPF/CRM TEMP, nome completo, e-mail e demais dados reais (hoje `90000000005` / `90000000006`, `TEMP-0005/CE` / `TEMP-0006/CE`, senha temp `viva@2026`)
- [ ] **Voltar (lista 22 / 2026-09-11):** campo RQE (não existe no schema); e-mail dos 3 novos (Mariana, Pedro Raphael, Luiz Eduardo); padronizar CRM (`/CE` vs `-CE`) e caixa do nome
- [x] Apelidos `Dr X` / `PIERRE` no **relatório de procedimentos** → nome completo + CRM do cadastro (2026-09-14; ver `10`)
- [ ] Revisar outros placeholders/incompletos no corpo clínico (além dos CPF `9000000…`)

Fila Master em `/avaliacao`: pendentes de `/cadastro` público. **Aprovar** → `ATIVO`; **Rejeitar** → `REJEITADO`. Botão **Busca médicos (CFM)** abre `portal.cfm.org.br/busca-medicos` (consulta manual).

## Changelog

### 2026-09-14 — Placeholders THALES e FREDDY BARBERY
- Criados no tenant Seja Viva Saúde (fantasma / depois dados reais):
  - **THALES** — CPF `90000000005`, CRM `TEMP-0005/CE`, sem e-mail, senha temp `viva@2026`
  - **FREDDY BARBERY** — CPF `90000000006`, CRM `TEMP-0006/CE`, sem e-mail, senha temp `viva@2026`
- Status `ATIVO`; anotar no mapa de bordo para substituição posterior

### 2026-09-14 — Apelidos do relatório → nome real
- Em produção: `relatorio_procedimentos_mes` (2026-01/02) — `Dr Sayro`, `Dr Yuri`, `Dra. Amanda`, `Dr. Tomaz`, `PIERRE`, etc. → nomes/CRM do corpo clínico
- 55 substituições; sem residual `Dr*`/`Dra*` em `profissional*Nome`
- Detalhe e mapa: `mapa-de-bordo.md`, `10-relatorios.md`

### 2026-09-11 — Conferência lista 22 médicos (produção)
- Cruzamento por CPF: **16** já ok com nome completo
- **Corrigidos:** THOMAZ (CPF/CRM placeholder), RAFAEL LIMA DA CUNHA (CPF placeholder), PIERRE → ANTONIO PIERRE AGUIAR JUNIOR
- **Criados:** MARIANA ALMEIDA SALES, PEDRO RAPHAEL ROCHA DE SOUSA, LUIZ EDUARDO SAMPAIO DUARTE (senha temp `viva@2026`, sem e-mail)
- Sem campo RQE no modelo `Medico` — não gravado
- Operação via Prisma no container; conferência final 22/22

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
