# 10 — Relatórios

**Status:** ✅ Implementado (procedimentos + ponto + plantões só-escala)  
**Última atualização:** 2026-08-19

## Relatórios de procedimentos

- `relatorio-procedimentos.service.ts`
- Admin: `GET/PUT /api/admin/relatorios/procedimentos/:mesRef`
- Import Excel (rota POST — ver `admin.routes.ts`)
- Frontend: `RelatoriosProcedimentos.tsx`
- Branch remota histórica: `cursor/relatorio-procedimentos-excel-import-ui`

### Visões em Lançamentos do mês

| Visão | Conteúdo |
|-------|----------|
| **Detalhado** | Tabela completa de lançamentos (editar/excluir) |
| **Produção por médico** | Resumo por médico + filtro opcional; ao filtrar, tabela detalhada (data, procedimento, posição 1.º/2.º, valor a receber, total). Excel/PDF exportam o detalhe filtrado ou o resumo |
| **Pacientes** | Prontuário, paciente, médico principal/auxiliar, data |

## Relatórios de ponto

- Listagem admin de registros (`listRegistrosPontoAdminController`)
- Export/visualização no front: `RelatoriosPontoEletronico.tsx`
- Hub: `Relatorios.tsx`

## Relatório financeiro — modalidade somente escala

Quando o subgrupo/contrato é **somente escala** (`usaEscala` e não `usaPonto`), não há batida de ponto. O hub `Relatorios.tsx` busca `GET /api/admin/relatorio-plantoes-somente-escala` (`ModuloSistema.RELATORIOS`) e **mergeia** com os registros de ponto (contratos mistos: cada escala entra só na fonte que lhe cabe).

Fórmula (alinhada ao relatório com ponto): `horasTurno × R$/h (ValorPlantao no dia, UTC) × (1 + adicional%)`.  
`EscalaMedico.valorHora` prevalece no **repasse**. `horasTurno` = snapshot ou duração do tipo.

Arquivos: `relatorio-plantoes-somente-escala.service.ts`, `valor-plantao-dia.util.ts`.

## UAT visual — contrato misto (agosto/2026)

Seed: `npx ts-node --transpile-only scripts/seed-faturamento-uat-demo.ts` (em `backend/`).  
Tabela para abrir no navegador: `backend/scripts/uat-faturamento-visual.html`.

Contrato **UAT Faturamento misto**, margem **25%** (cobrança = repasse ÷ 0,75):

| Escala | Profissional | Login | Cobrança/h | Repasse/h | 2 plantões 12h |
|--------|--------------|-------|------------|-----------|----------------|
| Escala + ponto | Dr. Teste Ponto | `uat.ponto@vivasaude.test` | R$ 120 | R$ 90 | Repasse **R$ 2.160** · Cobrança **R$ 2.880** |
| Somente escala | Dr. Teste Escala | `uat.escala@vivasaude.test` | R$ 100 | R$ 75 | Repasse **R$ 1.800** · Cobrança **R$ 2.400** |

Senha local dos dois: `Uat@2026`. Relatório: filtro do contrato + `2026-08-01`–`2026-08-31`. Sem o filtro de subgrupo, o contrato soma **R$ 3.960** / **R$ 5.280**.

## Dependências front

- `jspdf`, `jspdf-autotable` — PDF (topo com logo Viva Saúde via `utils/pdf-branding.ts` + `assets/logo-horizontal.png`)
- Em **Produção por médico** com médico filtrado: botão **Enviar demonstrativo** abre prévia (assunto/corpo do painel de e-mail) e anexa o PDF da produção
- `xlsx` — Excel

## Módulo de acesso

- `ModuloSistema.RELATORIOS` — necessário para rotas admin de registros

## Pendências

- [ ] `/atendimentos` ainda não tem relatórios — módulo ATENDIMENTOS é placeholder no UI
