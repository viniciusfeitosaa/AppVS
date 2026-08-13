# 12 — Mobile (Capacitor)

**Status:** ✅ Código + VPS (migration/worker/Firebase JSON) ok; ⏳ builds store + teste no aparelho  
**Última atualização:** 2026-08-13

## O que existe

- Capacitor configurado em `frontend/`
- **Android:** `frontend/android/` — `POST_NOTIFICATIONS`, canal `viva_default`, plugin Google Services condicional
- **iOS:** `frontend/ios/App/` — `UIBackgroundModes` remote-notification, `App.entitlements` (aps-environment)
- Plugin: `@capacitor/push-notifications`
- Script: `scripts/setup-capacitor-mobile.sh`
- Config dinâmica: `frontend/scripts/write-capacitor-config.mjs`

## Push notifications (FCM)

| Camada | Onde |
|--------|------|
| Token register/unregister | `POST /api/medico/push/register` · `unregister` |
| Broadcast Master | `POST /api/admin/push/broadcast` (módulo `CONFIGURACOES`) + UI `/enviar-aviso` |
| Fila | BullMQ `viva-push` (`backend/src/jobs/push-queue.ts`) |
| Envio | `firebase-admin` (`push-fcm.service.ts`) |
| App | `PushBootstrap` + `lib/pushNotifications.ts` (só nativo + role `MEDICO`) |
| Deep link | `data.path` / tipo → rota (`pushDeepLink.ts`) |

### Firebase (já feito no Console)

| Item | Valor / status |
|------|----------------|
| Projeto | `viva-saude-d4644` (nome **Viva Saude**) |
| Android package | `com.vivasaude.appvs` |
| iOS bundle | `com.vivasaude.appvs` |
| APNs Key ID | `TXP3335ZZL` |
| Apple Team ID | `Q2P77KWR49` |
| APNs | ✅ desenvolvimento + ✅ produção no Cloud Messaging |
| Service account local | `backend/secrets/firebase-adminsdk.json` (gitignored) + `FIREBASE_SERVICE_ACCOUNT_PATH` no `.env` local |
| Arquivos nativos locais | `google-services.json` e `GoogleService-Info.plist` no app (gitignored; ver `.example` Android) |

### Checklist VPS (humano)

1. [x] **JSON** da service account na VPS: `backend/secrets/firebase-adminsdk.json` (gitignored; mount `/app/secrets`)
2. [x] **Env** `FIREBASE_SERVICE_ACCOUNT_PATH=/app/secrets/firebase-adminsdk.json` + recreate backend (2026-08-13) — Firebase init ok (`viva-saude-d4644`)
3. [x] **Migration** `20260813160000_device_push_tokens` → tabela `device_push_tokens` (aplicada na VPS em 2026-08-13)
4. [x] **Deploy** `main` + restart backend — worker BullMQ `[push-queue] worker ativo` (confirmado na VPS)
5. [x] **Verificar**: JSON montado e `firebase-admin` inicializa no projeto `viva-saude-d4644`
6. [ ] **Builds store**:
   ```bash
   cd frontend && npm run build && npx cap sync
   ```
   - Android Studio → AAB (bump `versionCode` se necessário)
   - Xcode → Push Notifications capability + IPA (`aps-environment` production no archive)
7. [ ] **Teste**: login associado no app nativo → permissão notificação → Master `/enviar-aviso` → push + sino in-app.

### Teste rápido (após Firebase na VPS + app nativo)

1. Login associado no app nativo → aceitar permissão de notificação.
2. Master → Administração → **Enviar aviso push**.
3. Associado deve receber push + item no sino in-app; toque abre `/dashboard` (aviso) ou rota do evento.

## Fluxo típico Cap sync

```bash
cd frontend
npm run build
npx cap sync
# Abrir Android Studio / Xcode a partir de android/ ou ios/
```

## Origem do ponto

Registros marcados com `OrigemRegistroPonto.APP_MEDICO` no schema.

## Considerações

- Permissões câmera/GPS/notificação no `Info.plist` (iOS) e manifest Android
- API URL em produção aponta para backend HTTPS (env no build Capacitor)
- WebView remota: deep link é tratado no JS do bundle servido
- **Nunca** versionar: `google-services.json`, `GoogleService-Info.plist`, `backend/secrets/`

## Pendências

- [x] Código push FCM (API, fila, Capacitor, UI Master)
- [x] Firebase projeto + apps Android/iOS
- [x] APNs no Firebase (dev + produção)
- [x] Service account local (gitignored)
- [x] Deploy `main` + migration + worker na **VPS** (2026-08-13)
- [x] Service account + env `FIREBASE_*` na **VPS** (JSON montado; init ok)
- [ ] Novo AAB/IPA + teste em dispositivo
- [ ] Confirmar Push capability no Xcode no archive
- [ ] Testes E2E mobile (não há harness automatizado)

## Changelog

### 2026-08-13 — Push FCM iOS/Android
- Backend: `DevicePushToken`, fila BullMQ, FCM, broadcast Master
- Frontend: Capacitor push, deep link, tela Enviar aviso
- Nativo: `POST_NOTIFICATIONS`, canal Android, background modes iOS
- Firebase Console: projeto `viva-saude-d4644`, APNs Key `TXP3335ZZL`
- Arquivos-chave: `backend/src/jobs/push-queue.ts`, `frontend/src/lib/pushNotifications.ts`, `contexto/12-mobile-capacitor.md`
- Migration: `backend/prisma/migrations/20260813160000_device_push_tokens`
- VPS: containers atualizados; migration aplicada; worker ativo; **ainda sem** `FIREBASE_SERVICE_ACCOUNT_*`
