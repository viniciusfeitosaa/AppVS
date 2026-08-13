# 07 — Ponto eletrônico

**Status:** ✅ Implementado (+ justificativa de ausência v1)  
**Última atualização:** 2026-08-13

## Funcionalidades

- Check-in / check-out (com foto ou `checkin-sem-foto`)
- Geolocalização e endereço configuráveis (`ConfigPontoEletronico`)
- Horário e tolerância de ponto
- Valores por dia (`valores_ponto_por_dia` migration)
- Histórico do médico e painel do dia
- Repasse/registro congelado (`repasse-registro-ponto.service.ts`)
- Índices de performance (`perf_ponto_indexes`, check-in médico)
- **Justificativa de ausência de ponto** — médico pede quando não concluiu o ponto; Master aceita/recusa; aceite gera `RegistroPonto` com origem `JUSTIFICADO_SEM_PONTO` e **valor cheio do plantão**

## Modelos Prisma

- `ConfigPontoEletronico` — regras por escala/equipe
- `RegistroPonto` — registros (`OrigemRegistroPonto`: `APP_MEDICO` | **`JUSTIFICADO_SEM_PONTO`**)
- `JustificativaAusenciaPonto` — pedido separado (`status`: `PENDENTE` | `ACEITA` | `RECUSADA`); amarra `escalaPlantaoId`; no aceite preenche `registroPontoId`
- `escalaId` opcional em registro (migration `registro_ponto_escala_optional`)

**Migration:** `20260813200000_justificativa_ausencia_ponto` — enum `JUSTIFICADO_SEM_PONTO`, tabela `justificativas_ausencia_ponto`, índice único parcial (1 `PENDENTE` por plantão)

## Justificativa de ausência — fluxo

### Médico

1. Abre **Justificar ausência de ponto** (menu Ponto).
2. API lista plantões **elegíveis** (`GET …/eligiveis`).
3. Escolhe plantão → informa horários alegados (entrada/saída) + motivo.
4. Pedido fica `PENDENTE`; acompanha em **Minhas justificativas**.

### Master

1. Fila em **Justificativas de ponto** (módulo `PONTO_ELETRONICO`).
2. Pode **editar horários alegados** antes de aceitar (auditoria; **não** alteram o valor).
3. **Aceitar** (transação):
   - Revalida elegibilidade (ainda sem ponto **fechado** no dia/escala).
   - Se existir ponto **aberto** no mesmo dia/escala → **remove** (sem repasse).
   - Cria `RegistroPonto` `JUSTIFICADO_SEM_PONTO` com `repasseValorCongelado` = **valor cheio do plantão**.
   - Marca justificativa `ACEITA` + notificação in-app (+ push FCM se configurado).
4. **Recusar** → `RECUSADA` + comentário opcional + notificação; ponto aberto (se houver) **permanece**.

### Pós-aceite

- Check-in normal **bloqueado** no mesmo dia/escala se já há justificativa `ACEITA` (evita segundo pagamento).
- Histórico e relatórios: badge **“Sem ponto — justificado”** (`SituacaoRegistroPonto.tsx`).
- Troca de plantão: se `escalaPlantao.medicoId` ≠ médico da justificativa, aceite falha com 409 (pedido pendente do médico antigo fica inválido na prática).

## Matriz de elegibilidade (criar pedido)

| Situação no plantão (médico + escala + dia do `EscalaPlantao`) | Elegível? |
|----------------------------------------------------------------|-----------|
| Nenhum check-in e nenhum check-out | **Sim** |
| Check-in feito, **sem** check-out (ponto aberto) | **Sim** |
| Check-in e check-out concluídos (`checkOutAt` preenchido) | **Não** |
| Justificativa `PENDENTE` ou `ACEITA` no plantão | **Não** |
| Após `RECUSADA` | **Sim** (novo pedido permitido) |

**Pré-requisitos adicionais:** vínculo na escala com produção **usa escala + usa ponto** (`allowPonto` + `requireJanelaPlantao`); médico autenticado = `medicoId` do slot. Sem prazo/competência na v1.

## Pagamento no aceite

Valor **cheio do plantão** (horários alegados não entram na fórmula):

1. `EscalaPlantao.valorHora` > 0 → total do plantão
2. Senão, `ValorPlantao` do contrato/grade (resolução equipe/subgrupo como hoje)
3. Senão, `EscalaMedico.valorHora` × duração oficial do turno
4. Senão → aceite falha (`Sem valor de plantão cadastrado`)

Helper: `justificativa-ausencia-ponto.valor.ts` (`resolverValorCheioPlantao`).

## API (`/api/ponto`)

Arquivo: `ponto.routes.ts` + `ponto.controller.ts` + `ponto.service.ts`

Exemplos:

- `POST /checkin`, `POST /checkout`, `POST /checkin-sem-foto`
- `GET /meu-dia`, `GET /historico`, `GET /can-checkin`
- Troca de plantão (ver também etapa 06)
- `GET /registros/:id/foto-checkin` — download autenticado

### Justificativa (médico)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/justificativas-ausencia/eligiveis` | Plantões elegíveis |
| POST | `/justificativas-ausencia` | Criar pedido (`escalaPlantaoId`, horários alegados, `motivo`) |
| GET | `/justificativas-ausencia/minhas` | Histórico do médico |

Service: `justificativa-ausencia-ponto.service.ts` + `justificativa-ausencia-ponto.controller.ts`

## Utils e testes

- `ponto-geo-config.util.ts` (+ testes Jest)
- `ponto.const.ts` — constantes de negócio
- `justificativa-ausencia-ponto.service.test.ts`, `.valor.test.ts`, `ponto.service.checkin-justificativa.test.ts`

## Frontend

| Arquivo | Função |
|---------|--------|
| `PontoEletronico.tsx` | Tela principal |
| `HistoricoPontos.tsx` | Histórico |
| `ValoresPonto.tsx` | Valores admin |
| `RelatoriosPontoEletronico.tsx` | Relatórios |
| `JustificarAusenciaPonto.tsx` | Médico: pedir justificativa de ausência |
| `JustificativasPontoAdmin.tsx` | Master: fila aceitar/recusar justificativas |
| `SituacaoRegistroPonto.tsx` | Badge **Sem ponto — justificado** |
| `PontoLocationMap.tsx` | Mapa Leaflet |
| `PontoEnderecoMapaBlock.tsx` | Endereço no mapa |

## Admin

- `GET/PUT /api/admin/config-ponto`
- `GET /api/admin/registros-ponto` (módulo `RELATORIOS`)
- `GET /api/admin/justificativas-ausencia?status=` — fila Master (`PONTO_ELETRONICO`)
- `POST /api/admin/justificativas-ausencia/:id/aceitar` — body opcional: `horarioAlegadoEntrada`, `horarioAlegadoSaida`
- `POST /api/admin/justificativas-ausencia/:id/recusar` — body opcional: `comentario`

## Changelog

### 2026-08-13 — Justificativa de ausência de ponto (v1)
- Pedido `JustificativaAusenciaPonto` → Master aceita/recusa → `RegistroPonto` `JUSTIFICADO_SEM_PONTO` com valor cheio
- Elegível: sem ponto fechado (inclui “só check-in”); bloqueia check-in pós-aceite; aceite cancela ponto aberto sem repasse
- Notificação in-app + push no aceite/recusa
- Migration: `20260813200000_justificativa_ausencia_ponto`
- Spec: `docs/superpowers/specs/2026-08-13-justificativa-ausencia-ponto-design.md`
- Arquivos: `justificativa-ausencia-ponto.service.ts`, rotas ponto/admin, `JustificarAusenciaPonto.tsx`, `JustificativasPontoAdmin.tsx`, `SituacaoRegistroPonto.tsx`

## Pendências

- [ ] **VPS:** `prisma migrate deploy` (`20260813200000_justificativa_ausencia_ponto`) + restart backend
- [ ] **Teste E2E manual:** médico pede → Master aceita → badge no histórico/relatório + bloqueio de check-in duplicado
- [ ] Validar regras de geo em produção por tenant
