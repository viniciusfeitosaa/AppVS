# 17 — Conteúdos / eventos (aulas ao vivo)

**Status:** parcial (anúncio + inscrição + frequência v1)  
**Última atualização:** 2026-07-31

## Decisão de produto

Conteúdo **não** é um post com aula já pronta. É um **anúncio** para captar participantes **antes** da aula ao vivo:

1. Equipe cria rascunho (título, data/hora, descrição, capa, palestrante)
2. **Abrir inscrições** (`PUBLICADO`) libera lista no app + link público — **sem exigir YouTube**
3. Link do YouTube pode ser preenchido perto do horário; médico vê placeholder até existir
4. **Durante a aula:** admin **abre frequência** → médico confirma no app; externo confirma no link com o **e-mail da inscrição**

Status interno continua `RASCUNHO | PUBLICADO | ENCERRADO` (UI: “Inscrições abertas” para `PUBLICADO`).

## Arquivos-chave

- Backend: `backend/src/services/conteudo.service.ts`, rotas admin/médico/público, `backend/src/utils/conteudo.util.ts`
- Frontend admin: `frontend/src/modules/conteudos/pages/ConteudosAdminPage.tsx`
- Médico: `ConteudosMedicoPage.tsx`, `ConteudoMedicoDetalhePage.tsx`
- Público: `ConteudoInscricaoPublicPage.tsx`, `ConteudoFrequenciaPublicPage.tsx`
- Spec/plano: `docs/superpowers/specs/2026-07-30-conteudos-frequencia-design.md`, `docs/superpowers/plans/2026-07-31-conteudos-frequencia.md`
- Prisma: `ConteudoEvento` (+ `tokenFrequencia`, `frequenciaAberta`), participantes (`presenteEm`, `presencaOrigem`)

## Changelog

### 2026-07-31 — Hardening segurança frequência (loop #1)
- Anti-enumeração: POST público sempre ACK genérico (não revela se e-mail está inscrito)
- QR gerado no cliente (`LocalQrCode` + `qrcode`) — sem api.qrserver.com
- Regenerar `tokenFrequencia`; token novo a cada **Abrir frequência**
- Security review: [Security Review](54ccfc43-3bec-46be-844b-0fd0df0915d6)

### 2026-07-31 — Inscrição: médico vs estudante
- Form público pergunta perfil; estudante: faculdade, semestre, liga (sem CRM/especialidade)
- Migration `20260731180000_conteudo_participante_perfil`
- Admin lista mostra perfil e dados de estudante
- Formulario não aparece se o link/evento estiver fechado

### 2026-07-31 — Frequência na aula (v1)
- Admin abre/fecha frequência; link + QR; lista Presente/Ausente
- Médico logado: `POST /medico/conteudos/:id/presenca`
- Externo: `GET/POST /conteudos/public/frequencia/:token` com e-mail da inscrição
- Migration: `20260731120000_conteudo_frequencia`

### 2026-07-30 — Anúncio / abrir inscrições sem YouTube
- Removida exigência de YouTube em create/update/`setEventoStatus` ao publicar
- Admin: botão “Abrir inscrições”, labels e helper texts alinhados ao fluxo de captação
- Médico: copy de “vídeo ainda não disponível” explica inscrição antecipada
- Arquivos: `conteudo.service.ts`, `ConteudosAdminPage.tsx`, `ConteudoMedicoDetalhePage.tsx`, `ConteudosMedicoPage.tsx`

## Pendências

- [ ] Documentar endpoints em tabela (admin / médico / público)
- [ ] Opcional: notificar inscritos quando o YouTube for adicionado
- [x] Frequência na aula (v1) — ver spec
- [ ] Opcional: OTP / link pessoal se abuso de e-mail for problema
