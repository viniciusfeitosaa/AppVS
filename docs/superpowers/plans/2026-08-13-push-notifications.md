# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar push iOS/Android via FCM, enfileirado em BullMQ, alinhado a `NotificacaoMedico`, com broadcast Master e deep link.

**Architecture:** Helper cria notificação in-app + job BullMQ; worker Firebase Admin envia FCM; Capacitor registra token; toque navega por `data.path`.

**Tech Stack:** Node/Express, Prisma, BullMQ/Redis, `firebase-admin`, Capacitor 6 `@capacitor/push-notifications`, React Router.

## Global Constraints

- Destinatários: apenas `MEDICO`
- Sem preferências por categoria no MVP
- Sem Redis: não falhar HTTP; skip + log
- Capacitor server.url remota: deep link no JS do WebView
- Não commitar `google-services.json` / service account JSON (só `.example`)

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/prisma/schema.prisma` + migration | `DevicePushToken` |
| `backend/src/jobs/push-queue.ts` | Queue/worker BullMQ |
| `backend/src/services/push-fcm.service.ts` | Firebase Admin send + prune tokens |
| `backend/src/services/push-token.service.ts` | register/unregister |
| `backend/src/services/notificacao-medico.service.ts` | helper create+enqueue; `AVISO_ADMIN` |
| `backend/src/controllers/push.controller.ts` | HTTP handlers |
| `backend/src/routes/medico.routes.ts` | register/unregister |
| `backend/src/routes/admin.routes.ts` | broadcast |
| `frontend/src/lib/pushNotifications.ts` | Capacitor init + listeners |
| `frontend/src/lib/pushDeepLink.ts` | tipo → path |
| `frontend/src/context/AuthContext.tsx` | register after login / unregister logout |
| `frontend/src/pages/...` or admin module | UI Enviar aviso |
| `contexto/12-mobile-capacitor.md` | setup Firebase/APNs |

---

### Task 1: Schema DevicePushToken

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: migration `device_push_tokens`

- [x] Add model + relations on `Medico` / `Tenant`
- [x] `npx prisma migrate dev` (ou criar SQL migration manual)
- [ ] Commit

### Task 2: FCM service + BullMQ queue

**Files:**
- Create: `backend/src/services/push-fcm.service.ts`
- Create: `backend/src/jobs/push-queue.ts`
- Modify: `backend/src/config/env.ts`, `backend/src/server.ts`
- Modify: `backend/package.json` (`firebase-admin`)
- Create: `backend/.env.example` keys

- [x] Install `firebase-admin`
- [x] Init from `FIREBASE_SERVICE_ACCOUNT_JSON` or path
- [x] Queue `viva-push`, worker send + delete invalid tokens
- [x] start/stop in `server.ts` like email queue
- [ ] Commit

### Task 3: Hook notificações + broadcast

**Files:**
- Modify: `backend/src/services/notificacao-medico.service.ts`
- Create: controllers/routes for push register + admin broadcast

- [x] `criarNotificacaoComPush` helper
- [x] Refactor creates to use helper (or enqueue after each create)
- [x] `AVISO_ADMIN` + `broadcastAvisoAdmin`
- [x] Routes + validation
- [ ] Commit

### Task 4: Capacitor + frontend

**Files:**
- Modify: `frontend/package.json` — `@capacitor/push-notifications`
- Create: `frontend/src/lib/pushDeepLink.ts`, `pushNotifications.ts`
- Modify: `AuthContext.tsx`, Android manifest / iOS Info if needed
- Admin UI broadcast

- [x] Plugin + sync notes
- [x] Init after login MEDICO
- [x] Deep link navigate
- [x] Master form “Enviar aviso”
- [ ] Commit

### Task 5: Docs + store notes

- [x] Update `contexto/12-mobile-capacitor.md` and `15-estado-atual-e-pendencias.md`
- [x] Document Firebase/APNs setup steps for human
- [ ] Commit

---

## Manual ops (humano)

1. Criar projeto Firebase + apps iOS/Android
2. Baixar `google-services.json` → `frontend/android/app/`
3. APNs key → Firebase Console
4. Service account JSON na VPS (`FIREBASE_SERVICE_ACCOUNT_JSON`)
5. Novo IPA/AAB com Push capability
