# Design: Margem de lucro na grade Repasse / Cobrança

**Data:** 2026-08-14  
**Status:** supersedido — direção do cálculo corrigida em [`2026-08-22-margem-cobranca-primeiro-design.md`](./2026-08-22-margem-cobranca-primeiro-design.md)  
**Telas:** `ValoresPonto`, `ValoresPlantao`

> Este doc descrevia o motor **repasse → cobrança** (ex.: 100 e 25% → 133,33). O produto passou a usar **cobrança → repasse** (ex.: 100 e 25% → 75).

## Problema

Hoje a UI pede **dois valores absolutos** por dia da semana (Repasse R$/h e Cobrança R$/h). O usuário pensa em **margem de lucro**: com repasse 100 e margem 25%, a cobrança deve ser **133,33** (`100 ÷ (1 − 0,25)`), não 125 (markup sobre o custo).

## Decisões

| Tema | Decisão |
|------|----------|
| Fórmula | Margem sobre o preço: `cobrança = repasse ÷ (1 − margem/100)` |
| Margem inversa | `margem = (1 − repasse/cobrança) × 100` |
| Granularidade | % **diferente por dia** (seg–dom) |
| Escopo | `ValoresPonto` **e** `ValoresPlantao` |
| Edição | Bidirecional: editar margem recalcula cobrança e vice-versa |
| Persistência | **Abordagem 1** — % só na UI; API/DB continuam com repasse + cobrança absolutos |

## UI

Por dia da semana, três campos:

1. **Repasse (R$/h)** — editável  
2. **Margem (%)** — editável (0 ≤ margem &lt; 100)  
3. **Cobrança (R$/h)** — editável  

Instruções curtas na seção: explicar que a margem é sobre o valor cobrado (ex.: 100 + 25% → 133,33).

Botão **→** na segunda: replica repasse + margem para ter–dom e **recalcula** cobrança em cada dia (ou replica os três valores já calculados — efeito equivalente se a fórmula for aplicada).

Um único **Salvar semana** continua gravando repasse e cobrança da semana.

## Regras de sincronização (draft local)

| Ação do usuário | Efeito |
|-----------------|--------|
| Altera **margem** (com repasse válido) | `cobrança = round2(repasse / (1 - margem/100))` |
| Altera **cobrança** (com repasse &gt; 0) | `margem = (1 - repasse/cobrança) * 100` |
| Altera **repasse** e margem está preenchida | recalcula **cobrança** |
| Altera **repasse**, margem vazia, cobrança preenchida | recalcula **margem** |
| Load da API (ambos repasse e cobrança &gt; 0) | deriva margem para o draft |
| Margem ≥ 100 ou negativa | inválido — não calcular; feedback de erro no campo/salvar |
| Repasse 0 / vazio | não forçar cobrança; margem vazia se cobrança também vazia |

Arredondamento monetário: **2 casas decimais** (pt-BR). A margem exibida pode ter 2 casas; aceitar que 25% exato possa oscilar levemente após ida e volta por R$ (ex.: 24,99 / 25,00).

## Persistência / API

Sem migration. Payloads existentes:

- Ponto: `valorHora`, `valorHoraCobranca`, `valorHoraPorDia`, `valorHoraCobrancaPorDia`
- Plantão/escala: mesmos campos por tipo de plantão (`grade`)

A margem **não** é enviada ao backend.

## Fora de escopo

- Coluna/JSON de margem no Prisma
- Alterar fórmulas de relatórios (já usam cobrança absoluta)
- Markup (`× (1 + %)` ) como modo alternativo na UI

## Critérios de sucesso

1. Em ambas as telas, usuário digita repasse 100 e margem 25 → cobrança mostra ~133,33  
2. Usuário ajusta cobrança para 133,33 → margem ~25%  
3. `→` na segunda propaga a lógica para ter–dom  
4. Salvar e recarregar: repasse/cobrança iguais ao gravado; margem rederivada  
5. Sem regressão nos endpoints atuais de valores

## Arquivos prováveis

- `frontend/src/pages/ValoresPonto.tsx`
- `frontend/src/pages/ValoresPlantao.tsx`
- Opcional: helper compartilhado `frontend/src/utils/margemLucro.ts` (calcular / inverter / validar)
