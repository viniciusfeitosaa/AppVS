# Evolution GO — plano de integração (Viva Saúde)

Documentação oficial: [Evolution Foundation — Evolution GO](https://docs.evolutionfoundation.com.br/evolution-go)

## Objetivo

Substituir a **Evolution API (Node.js)** pela **Evolution GO** (Go + whatsmeow) na VPS Viva Saúde, com menor consumo de RAM/CPU e mesma função: envio de WhatsApp transacional (começando por **esqueci senha**).

## Estado atual no AppVS

| Item | Situação |
|------|----------|
| Código | `auth.service.ts` chama Evolution **legada**: `POST /message/sendText/{instance}` + `Authorization: Bearer` |
| Env | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` |
| Fallback | Twilio (pago) se Evolution não configurada |
| Landing | Links `wa.me` manuais (comercial) — **fora** do escopo inicial |
| Notificações in-app | `notificacao-medico.service` — sem WhatsApp ainda |

## Diferenças Evolution API vs Evolution GO

| | Evolution API (legada) | Evolution GO |
|--|------------------------|--------------|
| Runtime | Node.js | Go |
| Envio texto | `POST /message/sendText/{instance}` | `POST /send/text` |
| Auth | `Authorization: Bearer {key}` | Header `apikey: {GLOBAL_API_KEY ou token da instância}` |
| Instância | Nome na URL | UUID (`instanceId` no header) + nome na criação |
| QR / status | `/instance/{name}/qrcode` | `/instance/connect`, `/instance/status` |
| Webhooks | Por instância | `POST /instance/connect` com `webhook` na config |

## Arquitetura alvo

```
┌─────────────────┐     rede interna      ┌──────────────────┐
│ app-medico-     │ ────────────────────► │ evolution-go     │
│ backend         │   apikey + instanceId │ :8080            │
└────────┬────────┘                       └────────┬─────────┘
         │                                         │
         │ POST /api/webhooks/evolution-go         │ WhatsApp
         ◄─────────────────────────────────────────┘
         NPM (sejavivasaude.com.br)
```

- **Evolution GO** roda em container separado na mesma VPS (`docker-compose.evolution-go.yml`).
- Backend fala só com URL interna: `http://evolution-go:8080`.
- **Painel web:** `https://whatsapp.vivasaude.cloud` (NPM → container `evolution-go`).
- Webhook (fase 2) exposto via NPM em rota dedicada, com secret.

## Fases

### Fase 1 — Fundação (esta entrega)

- [x] Serviço `evolution-whatsapp.service.ts` com provider `go` | `legacy`
- [x] Variáveis de ambiente documentadas
- [x] Esqueci-senha usando o novo serviço
- [x] `docker-compose.evolution-go.yml` para subir stack na VPS
- [ ] Deploy na VPS + parear QR da instância `viva-saude`

### Fase 2 — Operação

- [x] Endpoint webhook `POST /api/webhooks/evolution-go` (menu de atendimento automático)
- [ ] Health no `/health` do backend (ping Evolution GO)
- [ ] Painel master: status instância + link QR (opcional)

### Fase 3 — Produto

- [ ] WhatsApp para notificações críticas (escala, ponto, vaga) — fila BullMQ
- [ ] Templates por tipo de mensagem
- [ ] Opt-in / LGPD (telefone já usado no cadastro)

## Variáveis de ambiente (backend)

```env
# Provider: go (Evolution GO) ou legacy (Evolution API Node)
EVOLUTION_PROVIDER=go

# URL base (sem barra final). Na VPS Docker: http://evolution-go:8080
EVOLUTION_API_URL=http://evolution-go:8080

# GLOBAL_API_KEY do Evolution GO (ou token da instância para envio)
EVOLUTION_API_KEY=sua-chave-segura

# Evolution GO: UUID da instância (header instanceId)
EVOLUTION_INSTANCE_ID=uuid-retornado-no-create

# Legado: nome da instância na URL
# EVOLUTION_INSTANCE=nome-instancia

# Webhook (fase 2)
# EVOLUTION_WEBHOOK_SECRET=...
```

## Acesso ao painel (produção)

| Item | Valor |
|------|--------|
| URL do painel | `https://whatsapp.vivasaude.cloud` (após DNS + SSL) |
| Login do painel | `/manager/login` |
| URL da API (no formulário de login) | `https://whatsapp.vivasaude.cloud` |
| API Key | valor de `EVOGO_GLOBAL_API_KEY` em `.env.evolution-go` (mesmo em `EVOLUTION_API_KEY` no `.env` do AppVS) |
| Admin local (só na VPS) | `http://127.0.0.1:8085/manager/login` |

### DNS (obrigatório para acesso externo)

Crie um registro **A** no domínio `vivasaude.cloud`:

```
whatsapp.vivasaude.cloud  →  187.77.247.33
```

### SSL no NPM

1. Acesse o NPM em `http://187.77.247.33:81`
2. Proxy Hosts → **whatsapp.vivasaude.cloud** → aba SSL → Request a new SSL Certificate (Let's Encrypt)
3. Force SSL

### Primeiro acesso ao painel Evolution GO

1. Abra **https://whatsapp.vivasaude.cloud/manager/login**
2. **Ative a licença** (email ou Google/GitHub — processo Evolution Foundation)
3. Na tela de login do painel:
   - URL da API: `https://whatsapp.vivasaude.cloud`
   - API Key: `grep EVOGO_GLOBAL_API_KEY .env.evolution-go` (na VPS)
4. **Instâncias** → **+ Nova Instância** → nome `viva-saude`
5. **Conectar** → escaneie o QR com o WhatsApp oficial da Viva Saúde
6. Copie o **UUID da instância** para o `.env` do AppVS: `EVOLUTION_INSTANCE_ID=...`
7. Reinicie o backend: `docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d backend`


```bash
cd /home/vivasaude/Desktop/AppVS

# 1. Copiar e editar env
cp .env.evolution-go.example .env.evolution-go
# Definir GLOBAL_API_KEY forte

# 2. Stack
docker compose -f docker-compose.evolution-go.yml --env-file .env.evolution-go up -d

# 3. Criar instância
curl -X POST http://127.0.0.1:8085/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -d '{"instanceName":"viva-saude","integration":"WHATSAPP-BAILEYS"}'

# 4. QR Code — substitua viva-saude pelo instanceName
curl http://127.0.0.1:8085/instance/viva-saude/qrcode \
  -H "apikey: SUA_GLOBAL_API_KEY"

# 5. Colar EVOLUTION_INSTANCE_ID e EVOLUTION_API_KEY no .env do AppVS
# 6. Reiniciar backend
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d backend
```

## Teste de envio

```bash
curl -X POST http://127.0.0.1:8085/send/text \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE" \
  -H "instanceId: UUID_DA_INSTANCIA" \
  -d '{"number":"5511999999999","text":"Teste Viva Saúde"}'
```

## Segurança

- Não publicar porta `8080` do Evolution GO na internet; só rede Docker + NPM para webhook.
- `GLOBAL_API_KEY` longa e única; rotacionar se vazar.
- Webhook com secret e validação de IP (NPM) na fase 2.
- Mensagens transacionais apenas (senha, alertas operacionais); evitar spam.

## Referências

- [Instalação Evolution GO](https://docs.evolutionfoundation.com.br/evolution-go/installation)
- [Enviar texto](https://docs.evolutionfoundation.com.br/evolution-go/send-a-text-message)
- [Webhooks](https://docs.evolutionfoundation.com.br/evolution-go/webhooks)
- [Docker Hub — evoapicloud/evolution-go](https://hub.docker.com/r/evoapicloud/evolution-go)
