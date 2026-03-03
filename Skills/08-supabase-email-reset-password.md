# Supabase: template de e-mail para Reset Password

Configuração do e-mail de redefinição de senha no Supabase (Authentication → Email Templates) para o projeto Viva Saúde.

## Onde configurar

1. **Supabase Dashboard** → seu projeto  
2. **Authentication** → **Email Templates**  
3. Aba **Reset Password**

---

## Assunto do e-mail (Subject)

Use um dos abaixo (ou adapte):

```
Redefinição de senha – Viva Saúde
```

ou

```
Altere sua senha – Viva Saúde
```

---

## Corpo do e-mail (Body)

O Supabase usa variáveis no estilo Go template. O link de confirmação é **`{{ .ConfirmationURL }}`** — não altere esse nome; o Supabase substitui pelo link real.

### Opção 1: corpo simples (texto)

```
Olá,

Você solicitou a redefinição de senha da sua conta no sistema Viva Saúde.

Clique no link abaixo para definir uma nova senha (o link expira em 1 hora):

{{ .ConfirmationURL }}

Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.

—
Sistema Viva Saúde
```

### Opção 2: corpo em HTML (recomendado)

Use no campo **Message (HTML)** ou no editor que aceita HTML:

```html
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
  <p style="color: #14532d; font-weight: 600; font-size: 1.1em;">Viva Saúde</p>
  <p>Olá,</p>
  <p>Você solicitou a redefinição de senha da sua conta no sistema Viva Saúde.</p>
  <p>Clique no botão abaixo para definir uma nova senha. O link expira em 1 hora.</p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #166534; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Redefinir senha</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.</p>
  <p style="color: #999; font-size: 0.85em; margin-top: 32px;">— Sistema Viva Saúde</p>
</div>
```

Cores usadas (paleta viva do projeto): `#166534` (viva-800), `#14532d` (viva-900).

---

## Redirect URL (para onde o usuário vai após clicar)

Depois que o usuário clica no link, o Supabase valida o token e redireciona para a sua aplicação.

1. No Supabase: **Authentication** → **URL Configuration**  
2. Em **Redirect URLs**, adicione a URL da sua app (uma por linha), por exemplo:
   - Produção: `https://sejavivasaude.com.br/app/redefinir-senha`
   - Desenvolvimento: `http://localhost:3000/redefinir-senha`
3. Em **Site URL**, use a base do app, por exemplo: `https://sejavivasaude.com.br/app` (produção) ou `http://localhost:3000` (dev).

Assim, após confirmar o reset, o usuário cai na rota `/redefinir-senha` do frontend (com base `/app` em produção).

---

## Integração com o app

- O frontend já tem a página **RedefinirSenha** em `/redefinir-senha`, que hoje espera `?token=...` (fluxo do backend próprio).
- Se o reset for feito **pelo Supabase Auth**, o Supabase pode enviar o token na **URL fragment** (hash) ou em query string, dependendo da configuração. Nesse caso, pode ser necessário ajustar a página **RedefinirSenha** para ler o token do formato que o Supabase envia (ex.: `#access_token=...&type=recovery`) e chamar a API do Supabase para trocar a senha, ou manter o backend como proxy.
- Se o reset continuar sendo feito **só pelo backend** (esqueci-senha + token no banco), o e-mail deve ser enviado pelo backend (nodemailer, Resend, etc.) com o link `{{FRONTEND_URL}}/redefinir-senha?token=...`; nesse fluxo o template do Supabase **não** é usado, a menos que o backend chame alguma função do Supabase para disparar o e-mail.

---

## Resumo

| Onde | O quê |
|------|--------|
| **Email Templates → Reset Password** | Colar o **Subject** e o **Message (HTML)** acima |
| **URL Configuration → Redirect URLs** | `https://sejavivasaude.com.br/app/redefinir-senha` (e dev se quiser) |
| **Site URL** | `https://sejavivasaude.com.br/app` (produção) |

O link no e-mail continua sendo **`{{ .ConfirmationURL }}`**; o Supabase substitui por um link que valida o token e depois redireciona para a URL configurada.

---

## Backend próprio (esqueci-senha): envio por SMTP

O projeto usa **backend próprio** para reset de senha (token no banco, rota `/auth/esqueci-senha`). O e-mail é enviado pelo backend com **nodemailer** quando as variáveis de SMTP estão configuradas.

### Variáveis no backend (Render / .env)

| Variável     | Obrigatório | Exemplo |
|-------------|-------------|---------|
| `SMTP_HOST` | Sim*        | `smtp.gmail.com` ou servidor do seu provedor |
| `SMTP_PORT` | Não         | `587` (default) |
| `SMTP_SECURE` | Não       | `false` para 587, `true` para 465 |
| `SMTP_USER` | Sim*        | E-mail que envia |
| `SMTP_PASS` | Sim*        | Senha ou “app password” |
| `SMTP_FROM` | Não         | Remetente ex: `noreply@sejavivasaude.com.br` |
| `FRONTEND_URL` | Sim (produção) | `https://sejavivasaude.com.br/app` (com `/app` se o app está em /app) |

\* Sem `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS`, o backend **não envia** e-mail: em produção só registra o link no log (para teste); em desenvolvimento devolve o link na resposta da API.

### Erro 500 em esqueci-senha

Se a API retornar 500 ao solicitar redefinição:

1. Ver os **logs do backend** (Render → Logs): o controller registra `[esqueci-senha] status message` e o stack do erro.
2. Causas comuns:
   - **Banco não configurado** (tenant padrão inexistente): rodar `npx prisma db push` e `npm run prisma:seed` no projeto.
   - **Tabela `reset_senha_tokens` ausente**: rodar migrações (`prisma migrate deploy`).
   - **Falha ao enviar e-mail** (SMTP incorreto): o backend retorna 500 com mensagem “Falha ao enviar e-mail”. Conferir host, porta, usuário, senha e se o provedor permite “app password” ou acesso SMTP.
