# Maddy — servidor de e-mail Viva Saúde

Integração **somente de e-mail** (SMTP). Não tem relação com Evolution GO nem WhatsApp.

## Arquitetura

```
AppVS backend  ──SMTP:587──►  maddy (Docker)  ──►  Internet
       │                            │
       └── rede proxy-network ──────┘
```

Todos os envios transacionais passam por `backend/src/utils/email-delivery.util.ts`:

| Fluxo | Serviço |
|-------|---------|
| Painel de E-mail (`/app/email`) | `modules/email/email.service.ts` |
| Esqueci senha | `auth.service.ts` → fila BullMQ |
| Cadastro público / aprovação | `cadastro-publico-email.service.ts` |

## Infra (Docker)

Stack em `/home/vivasaude/Desktop/docker/docker-compose.yml`:

- Container: `maddy` (`foxcpp/maddy:0.7`)
- Hostname público: `mail.vivasaude.cloud`
- Domínio de envio: `@vivasaude.cloud`
- Portas: 25, 587, 465
- TLS: certificados em `docker/maddy/certs/` (cópia do Let's Encrypt do NPM)

### Criar conta SMTP

```bash
docker exec -it maddy maddy creds create noreply@vivasaude.cloud
# Defina a senha; use a mesma em SMTP_PASS no .env do AppVS
```

### Renovar certificado TLS

Após renovar SSL do `mail.vivasaude.cloud` no NPM:

```bash
cd /home/vivasaude/Desktop/docker
NPM_LETSENCRYPT_LIVE=npm-5 ./sync-maddy-certs.sh
docker compose restart maddy
```

> Sem isso, o envio falha com `certificate has expired`.

## Variáveis no AppVS (`.env`)

```env
ORG_DISPLAY_NAME=Viva Saúde

SMTP_HOST=maddy
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@vivasaude.cloud
SMTP_PASS=<senha do maddy creds create>
SMTP_FROM=noreply@vivasaude.cloud
SMTP_TLS_SERVERNAME=mail.vivasaude.cloud
```

O backend precisa estar na rede `proxy-network` (já definido em `docker-compose.yml`) para resolver o hostname `maddy`.

## Painel no AppVS

**Administração → Painel de E-mail** (`/app/email`):

- Visão geral com status do Maddy (host, remetente, TLS)
- Botão **Testar conexão** → `POST /api/email/smtp/testar`
- Compose, rascunhos e histórico

## Teste rápido (API)

```bash
# Login master → token
curl -s -X POST https://sejavivasaude.com.br/api/auth/login-master \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'

# Testar SMTP
curl -s -X POST https://sejavivasaude.com.br/api/email/smtp/testar \
  -H "Authorization: Bearer $TOKEN"
```

## Resend (opcional)

Se `SMTP_*` estiver preenchido, o **Maddy tem prioridade**. Resend só é usado quando SMTP não está configurado.
