# Justificativa de ausência de ponto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o médico justifique plantão sem ponto completo (sem check-in/out ou só check-in sem checkout); Master aprova/recusa (pode editar horários); no aceite gera `RegistroPonto` `JUSTIFICADO_SEM_PONTO` com **valor cheio** e badge “Sem ponto — justificado”.

**Architecture:** Entidade `JustificativaAusenciaPonto` (pedido) → aprovação Master em transação cancela ponto aberto sem repasse → cria `RegistroPonto` justificado com `repasseValorCongelado` = total do plantão. Notificação in-app (+ push via helper existente).

**Tech Stack:** Prisma/Postgres, Express, Jest, React/Vite, padrão `criarNotificacaoComPush`.

**Spec:** `docs/superpowers/specs/2026-08-13-justificativa-ausencia-ponto-design.md`

## Global Constraints

- Elegível: **sem ponto fechado** no dia/escala; check-in aberto **é** elegível
- Pagamento no aceite: **plantão cheio** (horários alegados = auditoria)
- Sem prazo na v1
- Módulo Master: `PONTO_ELETRONICO` (primário)
- Não alterar fórmula do ponto `APP_MEDICO` normal
- Responder UI/API em português

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/prisma/schema.prisma` + migration | Enum origem, status, model justificativa |
| `backend/src/services/justificativa-ausencia-ponto.service.ts` | Elegibilidade, CRUD pedido, aceitar/recusar |
| `backend/src/services/justificativa-ausencia-ponto.valor.ts` | Resolver valor cheio do plantão |
| `backend/src/services/justificativa-ausencia-ponto.service.test.ts` | Testes de regras |
| `backend/src/services/ponto.service.ts` | Bloquear check-in se já justificado no plantão/dia |
| `backend/src/services/notificacao-medico.service.ts` | Tipos `JUSTIFICATIVA_PONTO_*` |
| `backend/src/utils/push-deep-link.util.ts` | Deep link → histórico/justificativas |
| `backend/src/controllers/justificativa-ausencia-ponto.controller.ts` | HTTP |
| `backend/src/routes/ponto.routes.ts` | Rotas médico |
| `backend/src/routes/admin.routes.ts` | Rotas Master |
| `backend/src/middleware/validation.middleware.ts` | Zod bodies |
| `frontend/src/pages/JustificarAusenciaPonto.tsx` | UI médico |
| `frontend/src/pages/JustificativasPontoAdmin.tsx` | Fila Master |
| `frontend/src/services/ponto.service.ts` + `admin.service.ts` | Clients API |
| `frontend/src/App.tsx` + `AppShell.tsx` | Rotas/menu |
| `frontend/src/pages/Relatorios.tsx` + `HistoricoPontos.tsx` | Badge |
| `contexto/07-ponto-eletronico.md` + `15-...` | Docs |

---

### Task 1: Schema Prisma + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260813200000_justificativa_ausencia_ponto/migration.sql`

**Produces:** enums + model `JustificativaAusenciaPonto` + relations

- [ ] **Step 1: Atualizar enums e model no schema**

Em `OrigemRegistroPonto` adicionar `JUSTIFICADO_SEM_PONTO`.

Adicionar:

```prisma
enum StatusJustificativaAusenciaPonto {
  PENDENTE
  ACEITA
  RECUSADA
}

model JustificativaAusenciaPonto {
  id                     String                           @id @default(uuid())
  tenantId               String                           @map("tenant_id")
  medicoId               String                           @map("medico_id")
  escalaId               String                           @map("escala_id")
  escalaPlantaoId        String                           @map("escala_plantao_id")
  horarioOficialInicio   DateTime                         @map("horario_oficial_inicio")
  horarioOficialFim      DateTime                         @map("horario_oficial_fim")
  horarioAlegadoEntrada  DateTime                         @map("horario_alegado_entrada")
  horarioAlegadoSaida    DateTime                         @map("horario_alegado_saida")
  motivo                 String                           @db.Text
  status                 StatusJustificativaAusenciaPonto @default(PENDENTE)
  comentarioMaster       String?                          @map("comentario_master") @db.Text
  decididoPorMasterId    String?                          @map("decidido_por_master_id")
  decididoEm             DateTime?                        @map("decidido_em")
  registroPontoId        String?                          @map("registro_ponto_id")
  createdAt              DateTime                         @default(now()) @map("created_at")
  updatedAt              DateTime                         @updatedAt @map("updated_at")

  tenant        Tenant          @relation(...)
  medico        Medico          @relation(...)
  escala        Escala          @relation(...)
  escalaPlantao EscalaPlantao   @relation(...)
  decididoPor   UsuarioMaster?  @relation(...)
  registroPonto RegistroPonto?  @relation(...)

  @@map("justificativas_ausencia_ponto")
  @@index([tenantId, status])
  @@index([tenantId, medicoId])
  @@index([escalaPlantaoId])
  @@unique([registroPontoId])
}
```

Unique parcial PENDENTE (SQL na migration; Prisma não expressa partial unique facilmente):

```sql
CREATE UNIQUE INDEX justificativas_ausencia_ponto_plantao_pendente_uidx
  ON justificativas_ausencia_ponto (escala_plantao_id)
  WHERE status = 'PENDENTE';
```

Relacionar em `Tenant`, `Medico`, `Escala`, `EscalaPlantao`, `UsuarioMaster`, `RegistroPonto` (opcional 1:1).

- [ ] **Step 2: Gerar client**

Run: `cd backend && npx prisma generate`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma
git commit -m "feat(ponto): schema justificativa de ausência de ponto"
```

---

### Task 2: Valor cheio do plantão + helpers de dia

**Files:**
- Create: `backend/src/services/justificativa-ausencia-ponto.valor.ts`
- Create: `backend/src/services/justificativa-ausencia-ponto.dia.ts`
- Test: `backend/src/services/justificativa-ausencia-ponto.valor.test.ts`

**Produces:**
- `resolverValorCheioPlantao(tenantId, escalaPlantaoId): Promise<number | null>`
- `intervaloDiaCivil(data: Date): { gte: Date; lte: Date }`

- [ ] **Step 1: Escrever teste do valor cheio**

```ts
describe('resolverValorCheioPlantao', () => {
  it('usa EscalaPlantao.valorHora como total quando > 0', async () => {
    // mock prisma ou fixture mínima
    expect(await resolverValorCheioPlantao(...)).toBe(1200);
  });
  it('usa EscalaMedico.valorHora × horasTurno quando plantão sem valor', async () => {
    expect(await resolverValorCheioPlantao(...)).toBe(100 * 12);
  });
});
```

Ordem (igual spec):
1. `EscalaPlantao.valorHora` > 0 → total
2. senão max `ValorPlantao` do grade/contrato
3. senão `EscalaMedico.valorHora × horasTurnoSnapshot|tipo|12`
4. senão `null`

- [ ] **Step 2: Implementar helpers**
- [ ] **Step 3: Rodar testes**

Run: `cd backend && npx jest src/services/justificativa-ausencia-ponto.valor.test.ts --forceExit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ponto): resolver valor cheio para justificativa"
```

---

### Task 3: Service — elegíveis, criar, listar minhas

**Files:**
- Create: `backend/src/services/justificativa-ausencia-ponto.service.ts`
- Test: `backend/src/services/justificativa-ausencia-ponto.service.test.ts` (regras com mocks ou DB de teste do projeto)

**Produces:**
- `listPlantoesElegiveisJustificativa(tenantId, medicoId)`
- `criarJustificativaAusenciaPonto(tenantId, medicoId, input)`
- `listMinhasJustificativas(tenantId, medicoId)`

**Elegibilidade de um `EscalaPlantao`:**
1. `medicoId` bate
2. `resolveProducaoMedicoNaEscala` → `allowPonto && requireJanelaPlantao`
3. **Não** existe `RegistroPonto` com `checkOutAt != null` do médico na `escalaId` no dia civil do plantão
4. Não há justificativa `PENDENTE` nem `ACEITA` para esse `escalaPlantaoId`
5. Snapshot oficial: usar `scheduleFromTipoRow` / `plantao-horario` + data do plantão → `horarioOficialInicio/Fim`

**Criar input:**
```ts
{
  escalaPlantaoId: string;
  horarioAlegadoEntrada: Date;
  horarioAlegadoSaida: Date;
  motivo: string; // trim, min 10 chars
}
```

Validações: saída > entrada; motivo length; revalidar elegibilidade; `status: PENDENTE`.

- [ ] **Step 1: Testes** — sem ponto → ok; com fechado → throw 409; com aberto → ok; motivo curto → 400
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Jest pass**
- [ ] **Step 4: Commit** `feat(ponto): criar e listar justificativas do médico`

---

### Task 4: Service — aceitar / recusar + cancelar aberto

**Files:**
- Modify: `backend/src/services/justificativa-ausencia-ponto.service.ts`
- Modify: `backend/src/services/notificacao-medico.service.ts` (`TIPO_NOTIFICACAO`)
- Modify: `backend/src/utils/push-deep-link.util.ts`

**Produces:**
- `aceitarJustificativa(tenantId, masterId, id, { horarioAlegadoEntrada?, horarioAlegadoSaida? })`
- `recusarJustificativa(tenantId, masterId, id, comentario?)`
- `temJustificativaAceitaNoDiaEscala(tenantId, medicoId, escalaId, checkInAt): Promise<boolean>` (para Task 5)

**Aceitar (transação Prisma):**
1. Lock/read `PENDENTE`; revalidar sem ponto **fechado**
2. `deleteMany` registros **abertos** (`checkOutAt: null`) do médico naquela `escalaId` cujo `checkInAt` cai no dia civil do plantão (e/ou qualquer aberto da mesma escala se for o único aberto do médico — preferir filtro dia+escala; se o aberto for de outra escala, **não** apagar)
3. `resolverValorCheioPlantao` — se null → throw 400 “Sem valor de plantão cadastrado”
4. Criar `RegistroPonto`:
   - `origem: JUSTIFICADO_SEM_PONTO`
   - `checkInAt`/`checkOutAt` = horários finais
   - `duracaoMinutos = max(1, floor((out-in)/60000))`
   - `repasseValorCongelado = valorCheio`
   - `observacao = Justificativa <id>: <motivo truncado>`
5. Update justificativa → `ACEITA`, `registroPontoId`, `decididoPorMasterId`, `decididoEm`, horários se editados
6. `criarNotificacaoComPush` tipo `JUSTIFICATIVA_PONTO_ACEITA` → path `/historico-pontos`

**Recusar:** status `RECUSADA` + comentário; notificar `JUSTIFICATIVA_PONTO_RECUSADA`. Ponto aberto intacto.

**Troca de plantão:** ao aceitar troca que muda `medicoId` do slot, se existir justificativa `PENDENTE` do médico antigo → `RECUSADA` com `comentarioMaster = 'Plantão transferido'` (hook no service de troca **ou** revalidação no aceitar que falha se plantão.medicoId != justificativa.medicoId — mínimo: validar no aceitar/criar).

- [ ] **Step 1: Testes** aceite cancela aberto; valor cheio; recusa reabre elegibilidade
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Commit** `feat(ponto): aceitar/recusar justificativa de ausência`

---

### Task 5: Bloquear check-in após justificado

**Files:**
- Modify: `backend/src/services/ponto.service.ts` (fluxo check-in, ~antes de criar registro)

- [ ] **Step 1:** No check-in com `escalaId` real, se existir `RegistroPonto` `JUSTIFICADO_SEM_PONTO` do médico na escala no dia civil de “hoje” (ou plantão do dia), throw `409` com mensagem: `Este plantão já foi justificado e aprovado. Não é possível bater ponto novamente.`

- [ ] **Step 2:** Teste unitário ou integração mínima do guard

- [ ] **Step 3: Commit** `fix(ponto): bloquear check-in após justificativa aceita`

---

### Task 6: Controllers, validation, routes

**Files:**
- Create: `backend/src/controllers/justificativa-ausencia-ponto.controller.ts`
- Modify: `backend/src/middleware/validation.middleware.ts`
- Modify: `backend/src/routes/ponto.routes.ts`
- Modify: `backend/src/routes/admin.routes.ts`

**Médico (`ponto.routes.ts`, auth médico):**
- `GET /justificativas-ausencia/eligiveis`
- `POST /justificativas-ausencia` body Zod: `escalaPlantaoId`, ISO dates, `motivo`
- `GET /justificativas-ausencia/minhas`

**Master (`admin.routes.ts`, `requireModuleAccess(PONTO_ELETRONICO)`):**
- `GET /justificativas-ausencia?status=PENDENTE`
- `POST /justificativas-ausencia/:id/aceitar`
- `POST /justificativas-ausencia/:id/recusar`

- [ ] **Step 1: Implementar validation + controllers + wire routes**
- [ ] **Step 2: Smoke manual ou supertest se o repo tiver padrão**
- [ ] **Step 3: Commit** `feat(ponto): API justificativa ausência de ponto`

---

### Task 7: Frontend médico

**Files:**
- Create: `frontend/src/pages/JustificarAusenciaPonto.tsx`
- Modify: `frontend/src/services/ponto.service.ts` (ou novo `justificativaPonto.service.ts`)
- Modify: `frontend/src/App.tsx` route `/justificar-ausencia-ponto`
- Modify: `frontend/src/components/Layout/AppShell.tsx` — item em `pontoMenuItemsMedico`

**UI:**
1. Lista elegíveis (data, escala, horário oficial)
2. Form: datetime-local entrada/saída + textarea motivo
3. Submit → toast sucesso → lista “minhas” com status
4. Copy clara: **“Você está declarando que não bateu o ponto corretamente neste plantão.”**

- [ ] **Step 1: Service client + página + menu + rota**
- [ ] **Step 2: Commit** `feat(ponto): tela médico justificar ausência de ponto`

---

### Task 8: Frontend Master

**Files:**
- Create: `frontend/src/pages/JustificativasPontoAdmin.tsx`
- Modify: `frontend/src/services/admin.service.ts`
- Modify: `frontend/src/App.tsx` `/justificativas-ponto`
- Modify: `AppShell.tsx` — Administração, módulo `PONTO_ELETRONICO`

**UI:**
- Tabela pendentes: médico, plantão, oficial, alegado, motivo
- Detalhe: editar alegados → Aceitar / Recusar (comentário)
- Lista histórico ACEITA/RECUSADA (filtro)

- [ ] **Step 1: Implementar**
- [ ] **Step 2: Commit** `feat(ponto): fila Master justificativas de ponto`

---

### Task 9: Badge em relatórios e histórico

**Files:**
- Modify: `frontend/src/pages/HistoricoPontos.tsx`
- Modify: `frontend/src/pages/Relatorios.tsx` (onde lista registros / origem)
- Modify: `frontend/src/pages/RelatoriosPontoEletronico.tsx` se listar origem

- [ ] Se `origem === 'JUSTIFICADO_SEM_PONTO'` (ou campo equivalente da API), mostrar pill/badge **“Sem ponto — justificado”**
- [ ] Garantir que API de histórico/admin devolva `origem`
- [ ] Commit `feat(ponto): badge sem ponto justificado nos relatórios`

---

### Task 10: Docs contexto

**Files:**
- Modify: `contexto/07-ponto-eletronico.md`
- Modify: `contexto/15-estado-atual-e-pendencias.md`

- [ ] Documentar fluxo, API, elegibilidade (matriz), origem nova
- [ ] Pendência: migration na VPS + teste E2E manual
- [ ] Commit `docs(ponto): justificativa ausência no mapa de bordo`

---

## Spec coverage check

| Spec | Task |
|------|------|
| Matriz elegibilidade (sem in/out, só in) | 3 |
| Plantão cheio + horários auditoria | 2, 4 |
| Master edita horários | 4, 8 |
| Cancela aberto no aceite | 4 |
| Bloqueio check-in pós-aceite | 5 |
| Badge | 9 |
| Notificação | 4 |
| Troca invalida pedido | 4 (validação medicoId) |
| Sem prazo | 3 (sem filtro data) |

## Placeholder scan

Nenhum TBD/TODO deixado nas tasks.
