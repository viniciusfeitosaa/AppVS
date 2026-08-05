# 17 — Conteúdos / eventos (aulas ao vivo)

**Status:** parcial (anúncio + inscrição + frequência + precadastro→corpo clínico v1)  
**Última atualização:** 2026-08-05

## Decisão de produto

Conteúdo **não** é um post com aula já pronta. É um **anúncio** para captar participantes **antes** da aula ao vivo:

1. Equipe cria rascunho (título, data/hora, descrição, capa, palestrante)
2. **Abrir inscrições** (`PUBLICADO`) libera lista no app + link público — **sem exigir YouTube**
3. Link do YouTube pode ser preenchido perto do horário; médico vê placeholder até existir
4. **Durante a aula:** admin **abre frequência** → médico confirma no app; externo confirma no link com o **e-mail da inscrição**
5. **Após a aula (ou a qualquer momento):** inscritos externos com interesse = **precadastro**; aceite da equipe manda para **cadastro de corpo clínico ATIVO** (sem Avaliação)

Status interno do evento: `RASCUNHO | PUBLICADO | ENCERRADO` (UI: “Inscrições abertas” para `PUBLICADO`).

## Precadastro ≠ corpo clínico

| Conceito | Significado |
|----------|-------------|
| Precadastro | `ConteudoParticipante` com `origem=EXTERNO` (dados da inscrição da aula). **Não** cria `Medico`. |
| Interesse corpo clínico | Checkbox no form de inscrição (`interesseCorpoClinico`) |
| Aceite admin | Master autoriza completar cadastro → e-mail + token |
| Corpo clínico | `Medico` com `statusCadastro=ATIVO` e login |

### Pipeline (opção A — sem Avaliação)

```
Inscrição externa → AGUARDANDO
       ↓ (Master aceita 1..N)
    ACEITO + e-mail com /conteudos/cadastro-corpo/:token
       ↓ (usuário completa)
    Medico ATIVO + CONVERTIDO
```

| Origem do cadastro | Destino | Passa por Avaliação? |
|--------------------|---------|----------------------|
| Precadastro **aceito** (link token) | `ATIVO` imediato | **Não** |
| `/cadastro` público | `PENDENTE_ANALISE` | **Sim** |
| Convite admin (`/ativar-conta`) | `ATIVO` no aceitar convite | **Não** |

### Status `precadastroStatus`

- `AGUARDANDO` — inscrição só; ainda sem aceite
- `ACEITO` — e-mail enviado; aguarda form
- `CONVERTIDO` — já é médico ATIVO

## Endpoints (principais)

### Admin (`/admin/conteudos`)

| Método | Rota | Notas |
|--------|------|--------|
| GET | `/eventos`, `/eventos/:id` | Lista / detalhe |
| POST/PATCH | `/eventos`… | Criar, editar, publicar, encerrar |
| GET | `/eventos/:id/participantes` | Inscritos do evento |
| DELETE | `/eventos/:id/participantes/:participanteId` | Remove da lista e do precadastro unificado |
| GET | `/precadastros` | Todos externos (+ status, campos faltantes) |
| POST | `/precadastros/aceitar` | Body `{ ids: uuid[] }` — e-mail + token |
| POST | `…/frequencia/abrir` / `fechar` | Frequência na aula |

### Público (`/conteudos/public`)

| Método | Rota | Notas |
|--------|------|--------|
| GET/POST | `/inscricao/:token` | Form + precadastro |
| GET/POST | `/palestrante/:token` | Cadastro palestrante (CPF; sem URL foto) |
| GET/POST | `/frequencia/:token` | Presença por e-mail (anti-enumeração no POST) |
| GET/POST | `/cadastro-corpo/:token` | Completar corpo clínico → ATIVO |

### Médico autenticado

| Método | Rota | Notas |
|--------|------|--------|
| GET | `/medico/conteudos` | Lista publicados |
| POST | `/medico/conteudos/:id/inscrever` | Inscrição app |
| POST | `/medico/conteudos/:id/presenca` | Frequência |

## Arquivos-chave

- Backend: `backend/src/services/conteudo.service.ts`, `cadastro-publico-email.service.ts` (`enviarEmailPrecadastroAceito`)
- Rotas: `conteudo-admin.routes.ts`, `conteudo-public.routes.ts`, `medico.routes.ts`
- Frontend admin: `ConteudosAdminPage.tsx`
- Público: `ConteudoInscricaoPublicPage.tsx`, `ConteudoFrequenciaPublicPage.tsx`, `ConteudoPalestrantePublicPage.tsx`, `ConteudoCadastroCorpoPublicPage.tsx`
- Prisma: `ConteudoEvento`, `ConteudoParticipante` (+ frequência, perfil, CPF, `precadastroStatus`, `tokenCadastroCorpo`)
- Spec frequência: `docs/superpowers/specs/2026-07-30-conteudos-frequencia-design.md`

## Changelog

### 2026-08-05 — Aceite de precadastro → corpo clínico (opção A)
- Admin: seleção 1/N + Aceitar; popup de dados; badges de status
- E-mail com link e lista de campos a completar
- POST público cria `Medico` ATIVO; token invalidado (`CONVERTIDO`)
- Migration: `20260805153000_conteudo_precadastro_aceite`
- Conflito e-mail/CPF existente: recusa o aceite com mensagem
- Arquivos: `conteudo.service.ts`, rotas admin/public, `ConteudosAdminPage.tsx`, `ConteudoCadastroCorpoPublicPage.tsx`, `App.tsx`

### 2026-08-05 — Excluir participante (admin)
- Confirmação modal; DELETE remove row (some participantes e precadastros)

### 2026-07-31 — CPF palestrante; sem URL de foto
- Form/API exigem CPF; removido campo `fotoUrl` do formulário público

### 2026-07-31 — Hardening segurança frequência
- Anti-enumeração no POST público; QR local (`LocalQrCode`); rotação de `tokenFrequencia`

### 2026-07-31 — Inscrição: médico vs estudante + CPF
- Perfil, faculdade/semestre/liga; CPF ambos; migrations perfil + CPF

### 2026-07-31 — Frequência na aula (v1)
- Admin abre/fecha; app médico; link externo por e-mail

### 2026-07-30 — Anúncio / abrir inscrições sem YouTube
- Publicar sem link de vídeo obrigatório

## Pendências

- [x] Documentar endpoints principais (tabela acima)
- [ ] Opcional: notificar inscritos quando o YouTube for adicionado
- [x] Frequência na aula (v1)
- [x] Precadastro → aceite → corpo clínico ATIVO (opção A)
- [ ] Opcional: OTP / link pessoal se abuso de e-mail na frequência for problema
- [ ] Documentos do perfil obrigatórios no form de cadastro-corpo (hoje alinhado a convite: sem upload)
