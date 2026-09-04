# 06 — Escalas e plantões

**Status:** ✅ Implementado (evolução contínua)  
**Última atualização:** 2026-09-04

## Modelo

| Modelo | Descrição |
|--------|-----------|
| `Escala` | Escala de trabalho |
| `EscalaMedico` | Médicos na escala |
| `EscalaPlantao` | Plantão agendado |
| `EscalaSubgrupo` / `EscalaEquipe` | Vínculos organizacionais |
| `TipoPlantao` | Tipos configuráveis |
| `ValorPlantao` / `AdicionalPlantaoData` | Valores por dia/equipe |
| `SolicitacaoTrocaPlantao` | Fluxo de troca entre médicos |

Migrations recentes (2026-04): troca de plantão — status, contrapartida, broadcast equipe, tipo ceder.

## Backend

- Rotas admin: CRUD escalas, plantões, médicos na escala
- Rotas ponto: trocas (`solicitar-troca-plantao`, aceitar/recusar, listagens)
- `tipo-plantao.service.ts`
- Utils: `plantao-horario.ts`

## Frontend

| Página | Função |
|--------|--------|
| `Escalas.tsx` | Gestão (lazy-loaded); **aba Tipos** = CRUD tipos de plantão do contrato |
| `TiposPlantaoContratoPanel.tsx` | UI reutilizável de tipos (horários da grade) |
| `SubgruposEquipes.tsx` | Fluxo contrato → subgrupo → equipe → **1 escala por equipe** (**auto** ao criar equipe) |
| `MeuCalendarioPlantoes.tsx` | Visão médico |
| `ValoresPlantao.tsx` | Configuração de valores |
| `ModuloEscalaMaster.tsx` | Ferramentas master (menu gated por `VALORES_PLANTAO`) |

## Regras importantes

- **1 equipe → no máximo 1 escala.** Ao **criar equipe**, a escala é criada automaticamente com o **mesmo nome** (vinculada ao subgrupo/contrato; `ativo: false`). Seção 3 só edita/exclui/abre; formulário manual só se a equipe ainda não tiver escala. API `addEquipeToEscala` retorna 409 se a equipe já estiver em outra escala.
- Valores plantão: unique por equipe/dia — migrations corrigiram índices legados (`20260331130000`, `20260331140000`)
- Troca de plantão: estados persistidos em `SolicitacaoTrocaPlantao` (ver migration `troca_plantao_status`)

## Changelog

### 2026-09-04 — Escala automática ao criar equipe
- `Criar equipe` em Subgrupos e Equipes também cria a escala com o mesmo nome e vincula subgrupo + equipe
- Formulário “3. Escala da equipe” só como fallback (equipes antigas sem escala)
- Backend: POST/PUT/DELETE `/equipes` e add/remove médico na equipe aceitam módulo **ESCALAS** (além de MEDICOS)
- Arquivos: `SubgruposEquipes.tsx`, `admin.routes.ts`

### 2026-09-02 — Editar nome da equipe
- Botão **Editar** na lista de equipes (Subgrupos e Equipes) + modal; `PUT /admin/equipes/:id`
- Arquivo: `SubgruposEquipes.tsx`

### 2026-08-23 — Margem: spec cobrança → repasse (pendente código)
- Mesma decisão do ponto: `repasse = cobrança × (1 − %)` em `ValoresPlantao.tsx`
- Spec: `docs/superpowers/specs/2026-08-22-margem-cobranca-primeiro-design.md`

### 2026-08-18 — Fechamento financeiro só-escala + menu
- Relatório financeiro passa a somar **plantões alocados** quando o subgrupo é `usaEscala && !usaPonto` (sem `RegistroPonto`)
- Menu `/modulo-escala-master` gated por `VALORES_PLANTAO` (antes `CONFIGURACOES`)
- Arquivos: `relatorio-plantoes-somente-escala.service.ts`, `valor-plantao-dia.util.ts`, `Relatorios.tsx`, `AppShell.tsx`
- Sem migration

### 2026-08-14 — Margem de lucro na UI de valores (plantão)
- Em `ValoresPlantao`, por tipo de plantão: Repasse + Margem (%) + Cobrança por dia (motor **legado** repasse → cobrança — ver 2026-08-23)
- Persistência inalterada (só R$/h absolutos); helper `margemLucro.ts`

### 2026-08-14 — Tipos de plantão na página Escalas
- CRUD de tipos (MT/SN/horários) saiu de Valores Hora/Plantão e foi para **Escalas → equipe → aba Tipos**
- Componente: `frontend/src/components/TiposPlantaoContratoPanel.tsx`
- Valores R$/h continuam em ValoresPlantao (só lê os tipos do contrato)

### 2026-08-14 — Uma escala por equipe
- Regra de negócio explícita: equipe não pode ter mais de uma escala; exclusão libera nova criação
- Arquivos: `frontend/src/pages/SubgruposEquipes.tsx`, `backend/src/services/grupo-equipe.service.ts`

## Pendências

- [ ] **Margem UI:** implementar spec `2026-08-22-margem-cobranca-primeiro-design.md` em `ValoresPlantao.tsx`
- [ ] Consolidar doc de estados da troca de plantão (enum/status) em tabela neste arquivo quando estabilizar
- [ ] Opcional: unique DB `@@unique([tenantId, equipeId])` em `EscalaEquipe` (hoje só validação no service)