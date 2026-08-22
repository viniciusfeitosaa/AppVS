# Design: Margem com cobrança como ponto de partida

**Data:** 2026-08-22  
**Status:** aprovado (conversa); aguardando revisão do arquivo  
**Telas:** `ValoresPonto`, `ValoresPlantao`  
**Substitui / corrige:** `docs/superpowers/specs/2026-08-14-margem-lucro-valores-design.md` (direção do cálculo)

## Problema

Na entrega de 2026-08-14 a UI parte do **repasse** e deriva a cobrança:

`cobrança = repasse ÷ (1 − margem/100)` → ex.: 100 e 25% → **133,33**

A operação pensa o contrário: define o que **cobra** e a margem; o **repasse** ao profissional é o que sobra. Quem criticou “está ao contrário” misturou isso com markup; o número desejado **não** é markup (`× 1,25` → 125), e sim margem com motor invertido.

## Decisão

| Tema | Decisão |
|------|----------|
| Tipo de % | Continua **margem** (não markup) |
| Fórmula | `repasse = cobrança × (1 − margem/100)` |
| Inversa | `margem = (1 − repasse/cobrança) × 100` (igual à já usada) |
| Exemplo canónico | Cobrança **100**, margem **25%** → repasse **75** |
| Ponto de partida | **Cobrança** + margem → recalcula **repasse** |
| Ordem na UI | Cobrança → Margem (%) → Repasse |
| Escopo | `ValoresPonto` e `ValoresPlantao` |
| Persistência | Sem migration; API/DB só R$ absolutos (repasse + cobrança) |

## Por que não é markup

| | Fórmula | 100 e 25% |
|---|---------|-----------|
| **Markup** (rejeitado) | `cobrança = repasse × (1 + %)` | cobrança **125** |
| **Margem, motor antigo** | `cobrança = repasse ÷ (1 − %)` | cobrança **133,33** |
| **Margem, motor novo** | `repasse = cobrança × (1 − %)` | repasse **75** |

Relação matemática da margem é a mesma nos dois motores; só muda qual campo o usuário digita primeiro.

## UI

Por dia da semana (e análogo em plantão por tipo):

1. **Cobrança (R$/h)** — editável (driver principal)  
2. **Margem (%)** — editável (0 ≤ margem &lt; 100)  
3. **Repasse (R$/h)** — editável (pode ajustar; recalcula margem)

Texto de ajuda: *“Margem sobre o valor cobrado. Ex.: cobrança 100 e margem 25% → repasse 75.”*

Botão **→** (replicar semana): propaga **cobrança + margem** e recalcula **repasse** nos demais dias (não copiar só o repasse antigo).

## Regras de sincronização (draft)

| Ação | Efeito |
|------|--------|
| Altera **margem** (cobrança válida) | `repasse = round2(cobrança × (1 − margem/100))` |
| Altera **cobrança** (margem preenchida) | recalcula **repasse** |
| Altera **cobrança**, margem vazia, repasse preenchido | recalcula **margem** |
| Altera **repasse** (cobrança &gt; 0) | recalcula **margem** |
| Load da API (ambos R$ &gt; 0) | deriva margem via `margemFromCobranca` |
| Margem ≥ 100 ou negativa | inválido — não calcular |
| Cobrança 0 / vazia | não forçar repasse |

Arredondamento: **2 casas** em R$; margem exibida até 2 casas.

## Helper (`margemLucro.ts`)

- Adicionar / tornar principal: `repasseFromMargem(cobranca, margemPct)`  
- Manter: `margemFromCobranca(repasse, cobranca)`  
- Deprecar ou deixar de usar no UI o fluxo `cobrancaFromMargem` como motor principal (pode permanecer só se algum teste legado precisar, ou remover se zero usos)

## Persistência / API

Inalterado:

- Ponto: `valorHora`, `valorHoraCobranca`, `valorHoraPorDia`, `valorHoraCobrancaPorDia`
- Plantão: mesmos campos na grade

Margem **não** é enviada ao backend. Relatórios continuam usando R$ absolutos já gravados.

## Dados já cadastrados

Nenhuma migration. Valores absolutos no banco **não mudam** só por esta correção de UI. Ao reabrir a tela, a margem continua rederivada de repasse + cobrança. Se alguém salvar de novo após editar só a margem com o motor novo, o **repasse** é que será recalculado (comportamento desejado).

## Fora de escopo

- Markup (`× (1 + %)`)
- Coluna de margem no Prisma
- Alterar fórmulas de relatório além do que já consomem cobrança/repasse absolutos
- Seed/UAT faturamento (só atualizar docs/exemplos se citarem 100→133,33)

## Critérios de sucesso

1. Em ambas as telas: cobrança 100 + margem 25 → repasse **75**  
2. Ajustar repasse com cobrança fixa → margem coerente  
3. `→` propaga cobrança+margem e recalcula repasse  
4. Salvar e recarregar: R$ iguais ao gravado; margem rederivada  
5. Texto de ajuda e docs de contexto sem o exemplo 100→133,33 como regra vigente  
6. Sem regressão nos endpoints de valores

## Arquivos prováveis

- `frontend/src/utils/margemLucro.ts` (+ testes)
- `frontend/src/pages/ValoresPonto.tsx`
- `frontend/src/pages/ValoresPlantao.tsx`
- `contexto/06-escalas-plantoes.md`, `contexto/07-ponto-eletronico.md` (parágrafo da fórmula)
- Opcional: nota em `docs/superpowers/specs/2026-08-14-margem-lucro-valores-design.md` apontando para este arquivo
