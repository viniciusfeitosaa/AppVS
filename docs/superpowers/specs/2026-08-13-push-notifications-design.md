# Design: Push notifications (iOS + Android)

**Data:** 2026-08-13  
**Status:** Aprovado (arquitetura 3 — FCM + BullMQ)  
**App:** Viva Saúde / Capacitor 6

## Decisões

| Tema | Escolha |
|------|---------|
| Escopo | Operacional completo + avisos administrativos |
| Destinatários | Associados (`MEDICO`) |
| Quem envia aviso geral | Master (matriz de módulos = gestão) |
| Provedor | Firebase Cloud Messaging (FCM) |
| Toque no push | Deep link para a tela do evento |
| Preferências por categoria | Não (MVP) — permissão do SO = recebe tudo |
| Entrega | Assíncrona via BullMQ (mesmo padrão do e-mail) |

## Arquitetura

```
Evento backend → NotificacaoMedico (sino)
              → enqueue BullMQ push-notifications
              → worker Firebase Admin SDK → FCM → device

Master "Enviar aviso" → createMany NotificacaoMedico + jobs push
App Capacitor → permissão → POST /medico/push/register (token)
Toque → deep link por tipo/metadata
```

## Modelo de dados

`DevicePushToken`:

- `id`, `tenantId`, `medicoId`
- `token` (único global)
- `platform`: `ios` | `android`
- `updatedAt`, `createdAt`
- Cascade ao apagar médico

## API

| Método | Rota | Quem |
|--------|------|------|
| POST | `/api/medico/push/register` | MEDICO — body `{ token, platform }` |
| DELETE | `/api/medico/push/unregister` | MEDICO — remove token |
| POST | `/api/admin/push/broadcast` | MASTER — `{ titulo, corpo }` cria notif + push |

## Fila BullMQ

- Nome: `viva-push` (ou `coopvitta-push`)
- Payload: `{ notificacaoId }` ou `{ medicoId, titulo, corpo, tipo, metadata, notificacaoId? }`
- Worker: resolve tokens do médico → `messaging.sendEachForMulticast` / send
- Tokens inválidos: apagar da tabela
- Sem Redis: log + skip (igual e-mail); não quebra a request HTTP

## Integração in-app

Centralizar criação de `NotificacaoMedico` em helper que:

1. Persiste a linha
2. Enfileira job push

Tipos existentes (`EQUIPE_VINCULO`, `ESCALA_NOVA`, `TROCA_PLANTAO_*`, `BOAS_VINDAS`, …) + novo `AVISO_ADMIN`.

## Deep links (rotas frontend)

| tipo | Rota |
|------|------|
| EQUIPE_VINCULO / SUBGRUPO_VINCULO | `/dashboard` |
| ESCALA_NOVA / ESCALA_EQUIPE_VINCULO | `/escalas` ou calendário do médico |
| TROCA_PLANTAO_* | `/calendario` ou dashboard |
| BOAS_VINDAS | `/dashboard` |
| AVISO_ADMIN | `/dashboard` (abre sino / lista) |
| DOCUMENTO_* (se passar a notificar) | `/meus-documentos` |
| VAGA_* | `/vagas` |

Payload FCM `data`: `{ tipo, notificacaoId, path }`

## App nativo

- `@capacitor/push-notifications`
- Android: `google-services.json`, permissão POST_NOTIFICATIONS (API 33+)
- iOS: Push capability, APNs key no Firebase, `UIBackgroundModes` remote-notification
- Registro do token após login autenticado; unregister no logout
- Listener `pushNotificationActionPerformed` → `navigate(path)`

## Fora do MVP

- Preferências por categoria
- Push para Master
- Web Push no browser
- Rich media / imagens

## Critérios de pronto

1. Associado logado no app recebe push de evento operacional (ex.: vínculo equipe)
2. Master envia aviso geral e associados recebem
3. Toque abre a tela mapeada
4. Token invalidado é removido
5. Docs em `contexto/12-mobile-capacitor.md` e pendências atualizadas
6. Novos builds store documentados (versão bump)
