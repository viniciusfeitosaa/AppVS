# Margem de lucro Repasse/Cobrança — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em `ValoresPonto` e `ValoresPlantao`, permitir editar margem de lucro (%) por dia junto com repasse/cobrança, com sync bidirecional; persistir só os valores absolutos já existentes.

**Architecture:** Helper puro `margemLucro.ts` (fórmula margem sobre preço). Drafts locais passam a incluir `margem%` por dia; onChange sincroniza os campos; save continua enviando apenas `valorHora*` + `valorHoraCobranca*`.

**Tech Stack:** React, TypeScript, React Query (já usado nas páginas). Testes do helper via `node --import tsx` / `npx tsx --test` no frontend (sem Vitest no repo).

**Spec:** `docs/superpowers/specs/2026-08-14-margem-lucro-valores-design.md`

## Global Constraints

- Fórmula: `cobrança = repasse ÷ (1 − margem/100)`; inversa `margem = (1 − repasse/cobrança) × 100`
- Margem por dia (seg–dom); 0 ≤ margem &lt; 100
- Bidirecional: editar margem ou cobrança
- Sem migration / sem campo de margem na API
- Escopo: `ValoresPonto.tsx` + `ValoresPlantao.tsx`
- Arredondamento R$: 2 casas; inputs pt-BR (vírgula) como hoje
- UI/copy em português

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/utils/margemLucro.ts` | `cobrancaFromMargem`, `margemFromCobranca`, `formatMargemDisplay`, validação |
| `frontend/src/utils/margemLucro.test.ts` | Testes unitários das fórmulas |
| `frontend/src/pages/ValoresPonto.tsx` | Draft margem/dia; UI 3 campos; sync; → replica |
| `frontend/src/pages/ValoresPlantao.tsx` | Idem por tipo de plantão |
| `contexto/07-ponto-eletronico.md` e/ou doc de valores | 1 parágrafo sobre margem na UI (Task docs) |

---

### Task 1: Helper `margemLucro` + testes

**Files:**
- Create: `frontend/src/utils/margemLucro.ts`
- Create: `frontend/src/utils/margemLucro.test.ts`

**Produces:**
```typescript
export function cobrancaFromMargem(repasse: number, margemPct: number): number | null;
// null se margem inválida (>=100, <0) ou repasse inválido

export function margemFromCobranca(repasse: number, cobranca: number): number | null;
// null se cobranca <= 0 ou repasse < 0; se cobranca < repasse, margem negativa → null ou permitir? Spec: margem >= 0 → retornar null se cobranca < repasse

export function roundMoney(n: number): number; // 2 casas
```

- [ ] **Step 1: Escrever testes** (casos: 100 + 25% → 133.33; inversa ~25; margem 100 → null; cobrança &lt; repasse → null)

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cobrancaFromMargem, margemFromCobranca, roundMoney } from './margemLucro.ts';

describe('margemLucro', () => {
  it('100 e 25% → 133.33', () => {
    assert.equal(cobrancaFromMargem(100, 25), 133.33);
  });
  it('100 e 133.33 → ~25%', () => {
    const m = margemFromCobranca(100, 133.33);
    assert.ok(m != null && Math.abs(m - 25) < 0.02);
  });
});
```

- [ ] **Step 2: Rodar — FAIL** (arquivo ainda não existe)

```powershell
cd frontend
npx --yes tsx --test src/utils/margemLucro.test.ts
```

- [ ] **Step 3: Implementar `margemLucro.ts`**
- [ ] **Step 4: Testes PASS**
- [ ] **Step 5: Commit** (se pedido): `feat(valores): helper margem de lucro repasse/cobrança`

---

### Task 2: UI + sync em `ValoresPonto`

**Files:**
- Modify: `frontend/src/pages/ValoresPonto.tsx`

**Interfaces:**
- Consumes: helpers da Task 1 + `parseValorInput` / `formatValor` locais
- Produces: draft `draftMargemPorDia: Record<DiaKey, string>`; handlers `onRepasseChange`, `onMargemChange`, `onCobrancaChange`; `→` replica seg → resto com recalculo

**Layout sugerido (por dia, um card):**
```
Seg
  Repasse [____]  Margem % [____]  Cobrança [____]  [→ só na seg]
```
Ou manter grids, mas **incluir linha/coluna de Margem** entre Repasse e Cobrança. Preferir **um card por dia** com os 3 inputs (mais claro para sync por dia).

Texto de ajuda:
> Margem de lucro sobre a cobrança. Ex.: repasse 100 e margem 25% → cobrança 133,33. Editar a cobrança recalcula a margem.

Load: ao hidratar drafts da API, para cada dia com repasse e cobrança &gt; 0, preencher margem via `margemFromCobranca`.

Save: inalterado além de garantir cobrança draft sincronizada antes do parse (não enviar margem).

- [ ] **Step 1: Estado `draftMargemPorDia` + hidratação no `useEffect` existente**
- [ ] **Step 2: Handlers de sync nos onChange**
- [ ] **Step 3: UI 3 campos + um `→` que copia repasse+margem da seg e recalcula cobrança ter–dom**
- [ ] **Step 4: Smoke manual — 100 / 25% → 133,33; salvar; reload
- [ ] **Step 5: Commit** (se pedido): `feat(ponto): margem % na grade de valores hora`

---

### Task 3: UI + sync em `ValoresPlantao`

**Files:**
- Modify: `frontend/src/pages/ValoresPlantao.tsx`

**Interfaces:**
- Mesmos helpers; drafts por `gradeId` → dia (espelhar estrutura atual `draftValorHoraPorDia` / `draftValorHoraCobrancaPorDia` com `draftMargemPorDia[gradeId][dia]`)

- [ ] **Step 1: Estado + hidratação por tipo de plantão**
- [ ] **Step 2: Handlers sync (iguais à Task 2)**
- [ ] **Step 3: UI por grade (3 campos / dia) + `→`**
- [ ] **Step 4: Smoke — mesmo caso 100/25%**
- [ ] **Step 5: Commit** (se pedido): `feat(plantao): margem % na grade valor por tipo`

---

### Task 4: Docs contexto

**Files:**
- Modify: `contexto/07-ponto-eletronico.md` (seção valores hora / ponto sem escala) — 1 parágrafo
- Modify: `contexto/06-escalas-plantoes.md` ou trecho de valores plantão se existir — 1 parágrafo
- Modify: `contexto/15-estado-atual-e-pendencias.md` — linha no histórico se necessário

- [ ] **Step 1: Documentar fórmula + “% só na UI”**
- [ ] **Step 2: Commit** (se pedido): `docs: margem de lucro na UI de valores`

---

## Spec coverage checklist

| Spec | Task |
|------|------|
| Fórmula margem / inversa | 1 |
| % por dia | 2, 3 |
| Bidirecional | 2, 3 |
| Sem persistir % | 2, 3 |
| ValoresPonto | 2 |
| ValoresPlantao | 3 |
| Docs | 4 |

---

## Execution

Plan saved to `docs/superpowers/plans/2026-08-14-margem-lucro-valores.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — um subagente por task, review entre tasks  
2. **Inline Execution** — executar nesta sessão com checkpoints  

**Which approach?**
