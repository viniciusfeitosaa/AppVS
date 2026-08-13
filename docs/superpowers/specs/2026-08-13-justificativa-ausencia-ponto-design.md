# Design: Justificativa de ausência de ponto

**Data:** 2026-08-13  
**Status:** Aprovado em brainstorming (aguardando review do arquivo antes do plano)  
**Etapa:** `contexto/07-ponto-eletronico.md`  
**Abordagem:** Pedido separado (`JustificativaAusenciaPonto`) → aprovação Master → `RegistroPonto` com origem `JUSTIFICADO_SEM_PONTO`

## Problema

Em contratos com **escala + ponto**, o repasse depende do check-out. Se o médico **esquece de bater o ponto**, hoje não há caminho estruturado para justificar e ainda assim receber o plantão — e não podemos simplesmente zerar o pagamento.

## Objetivos

1. Médico declara que **não bateu o ponto corretamente** em um plantão em que estava escalado.
2. Master revisa (pode editar horários alegados) e **aceita ou recusa**.
3. No aceite: médico recebe o **valor cheio do plantão**; o histórico deixa explícito que **não houve ponto real** (selo “Sem ponto — justificado”).
4. Horários alegados (e os editados pelo Master) são **auditoria**, não base de rateio.

## Não-objetivos (v1)

- Justificar / corrigir ponto batido na **escala errada** (dois pontos abertos já são impossíveis no sistema).
- Prazo / fechamento de competência (sem limite por enquanto; pode mudar depois).
- Anexo/foto obrigatório na justificativa.
- Master criar o pedido no lugar do médico.
- Alterar a fórmula do ponto **válido** (check-in/out normal continua proporcional às horas).

## Decisões de produto

| Tema | Escolha |
|------|---------|
| Elegibilidade | Só plantão **sem** ponto (aberto ou fechado) naquele dia/escala |
| Pagamento no aceite | **Plantão cheio** |
| Horários | Médico informa alegados; Master pode editar antes de aceitar |
| Prazo | Sem limite (v1) |
| Visibilidade | Selo claro de ausência de ponto em relatório/histórico |
| Arquitetura | Pedido separado + ponto gerado na aprovação |

## Confirmação técnica prévia

- Check-in bloqueia se já existe `RegistroPonto` com `checkOutAt: null` para o médico → **não há dois pontos abertos** em escalas diferentes ao mesmo tempo.
- É possível ter pontos **sequenciais** no mesmo dia (fecha um, abre outro); a justificativa v1 não cobre “corrigir escala errada”.

## Modelo de dados

### Enum `OrigemRegistroPonto`

Adicionar:

```text
JUSTIFICADO_SEM_PONTO
```

### Nova entidade `JustificativaAusenciaPonto`

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | uuid | PK |
| `tenantId` | string | |
| `medicoId` | string | Solicitante |
| `escalaId` | string | Escala do plantão |
| `escalaPlantaoId` | string | Slot agendado |
| `horarioOficialInicio` | DateTime | Snapshot do turno da escala |
| `horarioOficialFim` | DateTime | Snapshot do turno da escala |
| `horarioAlegadoEntrada` | DateTime | Informado pelo médico |
| `horarioAlegadoSaida` | DateTime | Informado pelo médico |
| `motivo` | text | Obrigatório |
| `status` | enum | `PENDENTE` \| `ACEITA` \| `RECUSADA` |
| `comentarioMaster` | text? | Principalmente na recusa |
| `decididoPorUserId` | string? | Master que decidiu |
| `decididoEm` | DateTime? | |
| `registroPontoId` | string? | Preenchido no aceite |
| `createdAt` / `updatedAt` | DateTime | |

**Constraints**

- No máximo **1** registro com `status = PENDENTE` por `escalaPlantaoId` (unique parcial ou índice único filtrado).
- Após `RECUSADA`, novo pedido no mesmo plantão é permitido.
- Após `ACEITA`, não reabre.

### `RegistroPonto` gerado no aceite

- `origem = JUSTIFICADO_SEM_PONTO`
- `escalaId` do pedido
- `checkInAt` / `checkOutAt` = horários finais (alegados ou editados pelo Master)
- `duracaoMinutos` derivado desses horários (informativo)
- `repasseValorCongelado` = **valor cheio do plantão** (ver seção Pagamento)
- Sem foto / sem geo (campos nulos)
- `observacao` pode referenciar a justificativa (id + trecho do motivo)

## Regras de elegibilidade (criar pedido)

Todas devem ser verdadeiras:

1. Médico autenticado é o `medicoId` do `EscalaPlantao`.
2. Escala/contrato com produção **usa escala + usa ponto**.
3. Não existe `RegistroPonto` do médico naquela `escalaId` cujo intervalo (check-in/out) cubra / pertença ao plantão do dia (regra prática v1: **nenhum ponto do médico naquela escala no dia civil do plantão**, aberto ou fechado — simples e conservadora).
4. Não existe justificativa `PENDENTE` para o `escalaPlantaoId`.
5. Não existe justificativa `ACEITA` já ligada a esse plantão / ponto justificado para o mesmo plantão.

## Pagamento (aceite)

Ordem para obter o **total do plantão** (não ratear):

1. Se `EscalaPlantao.valorHora` > 0 → usar como **total do plantão** (mesma semântica do freeze atual nesse campo).
2. Senão, `ValorPlantao` do contrato/grade (máximo / resolução equipe vs subgrupo como hoje) → total do plantão.
3. Senão, se `EscalaMedico.valorHora` > 0 → `valorHora × duração oficial do turno` (horas do tipo / snapshot).
4. Senão → falha na aprovação com mensagem clara (não cria ponto).

**Importante:** horas alegadas **não** entram na fórmula do valor.

## Fluxos

### Médico — solicitar

1. Lista plantões elegíveis (API).
2. Escolhe plantão → vê horário oficial.
3. Informa entrada/saída alegadas + motivo.
4. Status `PENDENTE`.

### Master — decidir

1. Fila de pendentes (módulo `PONTO_ELETRONICO` e/ou `ESCALAS`).
2. Pode editar `horarioAlegadoEntrada/Saida`.
3. **Aceitar** → transação: valida elegibilidade de novo → cria `RegistroPonto` → congela valor → marca justificativa `ACEITA` + `registroPontoId` → notifica médico.
4. **Recusar** → `RECUSADA` + comentário opcional → notifica médico.

### Pós-aceite / anti-duplicidade

- Bloquear check-in “normal” que geraria **segundo** pagamento para o mesmo plantão/dia/escala já coberto por `JUSTIFICADO_SEM_PONTO`.
- Relatórios: preferir `repasseValorCongelado`; exibir badge **“Sem ponto — justificado”** quando `origem = JUSTIFICADO_SEM_PONTO`.

### Troca de plantão

- Pedido amarra a `escalaPlantaoId`. Se o slot deixar de pertencer ao médico (troca aceita), pedidos `PENDENTE` devem ser **cancelados/invalidado** (status `RECUSADA` automática com comentário de sistema, ou status `CANCELADA` se quisermos enum dedicado — v1 preferível: `RECUSADA` com `comentarioMaster = "Plantão transferido"` / flag sistema).

## API (proposta)

### Médico (`/api/ponto` ou `/api/medico/...`)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/justificativas-ponto/eligiveis` | Plantões sem ponto elegíveis |
| POST | `/justificativas-ponto` | Criar pedido |
| GET | `/justificativas-ponto/minhas` | Histórico do médico |

### Master (`/api/admin/...`)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/justificativas-ponto` | Fila (filtro status) |
| POST | `/justificativas-ponto/:id/aceitar` | Body opcional: horários editados |
| POST | `/justificativas-ponto/:id/recusar` | Body: comentário opcional |

Autorização Master: módulo `PONTO_ELETRONICO` (primário); se o menu viver sob Escalas, aceitar também `ESCALAS`.

## UI

| Papel | Tela |
|-------|------|
| Médico | Ponto / histórico → “Justificar ausência de ponto” |
| Master | Administração → “Justificativas de ponto” (fila + detalhe Aceitar/Recusar) |
| Ambos | Relatórios e histórico com badge |

## Notificações (v1)

- **In-app** (`NotificacaoMedico`) no aceite e na recusa.
- Push FCM: desejável se o gancho for trivial; não bloqueia v1.

## Testes mínimos

- Elegível sem ponto → cria `PENDENTE`.
- Com ponto no dia/escala → 400/409.
- Segundo `PENDENTE` no mesmo plantão → 409.
- Aceite → `RegistroPonto` `JUSTIFICADO_SEM_PONTO` + valor cheio + status `ACEITA`.
- Recusa → sem registro; médico pode reabrir.
- Check-in após aceite do mesmo plantão → bloqueado.
- Relatório mostra badge e soma o congelado uma vez.

## Arquivos-chave previstos

- `backend/prisma/schema.prisma` + migration
- `backend/src/services/justificativa-ausencia-ponto.service.ts` (novo)
- `backend/src/services/ponto.service.ts` (elegibilidade / bloqueio pós-aceite)
- `backend/src/services/repasse-registro-ponto.service.ts` ou helper de “valor cheio”
- Rotas/controllers ponto + admin
- Frontend: página médico + fila Master + badge em `Relatorios.tsx` / histórico
- `contexto/07-ponto-eletronico.md` + `15-estado-atual-e-pendencias.md` na entrega

## Changelog da spec

- 2026-08-13: Versão inicial aprovada no brainstorming (opções A elegibilidade, B pagamento cheio + horários alegados, Master edita horários, prazo A).
