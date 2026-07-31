# 15 — Estado atual e pendências

**Snapshot:** 2026-07-30  
**Branch:** `main` (sync com `origin/main` após push desta entrega)

> Este arquivo deve ser o **primeiro** atualizado após entregas relevantes.  
> É o **mapa de bordo** do projeto (o que está pronto, o que falta, histórico recente).

## Resumo executivo

O **Viva Saúde** está em produção na VPS (`sejavivasaude.com.br`). Auth, escalas, ponto, vagas, documentos, relatórios, painel de e-mail, robô WhatsApp (Evolution GO), mobile e deploy estão implementados.

## Módulos — status

| Módulo | Backend | Frontend | Notas |
|--------|---------|----------|-------|
| Auth / cadastro | ✅ | ✅ | 3 fluxos de login |
| Dashboard | ✅ | ✅ | |
| Médicos | ✅ | ✅ | Convites, status cadastro |
| Contratos | ✅ | ✅ | |
| Escalas / plantões | ✅ | ✅ | Trocas de plantão |
| Valores plantão/ponto | ✅ | ✅ | |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Procedimentos + ponto; PDF com logo VS |
| Painel de E-mail | ✅ | ✅ | NF / demonstrativos; anexo PDF |
| WhatsApp (Evolution GO) | ✅ | — | Menu atendimento; pausar/retomar (equipe) |
| Conteúdos / eventos | ✅ | ✅ | Anúncio + inscrições; frequência v1 (admin + app + e-mail) |
| Configurações / módulos | ✅ | ✅ | Matriz de acesso |
| Avaliação (master) | ✅ | ✅ | `MasterOnly` |
| Atendimentos | — | ⏳ Placeholder | `FeaturePlaceholder` |
| Landing | ✅ | ✅ | + pasta `landing/` |

## Qualidade

| Item | Status |
|------|--------|
| Testes backend Jest | ✅ |
| Migrations Prisma | ✅ |
| CI GitHub Actions | ✅ `ci.yml`, `deploy-vps.yml` |
| Docs raiz README/CHECKLIST | ⚠️ Desatualizados |
| Ícone PWA | ✅ Viva Saúde (VS), não CoopVitta |

## Pendências prioritárias

1. **Atendimentos** — definir escopo e implementar (hoje só placeholder)
2. **Sincronizar README/CHECKLIST** ou marcar como arquivados apontando para `contexto/`
3. **Harness** — manter esta pasta após cada feature (ver `16-como-atualizar.md`)
4. **WhatsApp** — health no `/health` do backend (ping Evolution GO); painel master opcional (QR/status)

## Pendências menores

- Documentar estados finitos de `SolicitacaoTrocaPlantao` em `06-escalas-plantoes.md`
- Processo de publicação App Store / Play Store em `12-mobile-capacitor.md`
- Tabela de endpoints de vagas em `08-vagas.md`

## Histórico de entregas recentes

| Data | Entrega |
|------|---------|
| 2026-07-31 | Conteúdos: **frequência** na aula (admin abre/fecha; médico no app; externo por e-mail) — `17-conteudos-eventos.md` |
| 2026-07-30 | Conteúdos: modelo **anúncio** — abrir inscrições sem YouTube; copy admin/médico (ver `17-conteudos-eventos.md`) |
| 2026-07-30 | Robô WhatsApp: `pausar`/`retomar` **só pela equipe** (silencioso + apaga comando); fix retomar com JID `@lid` ↔ telefone; `readMessages=false` |
| 2026-07-21 | Logo VS nos PDFs; enviar demonstrativo da produção (prévia + PDF anexo); contatos/e-mails médicos; ícone PWA VS |
| 2026-07 | Painel de e-mail (NF/demonstrativos), Evolution GO, filtro produção por médico |
| 2026-04 | Trocas de plantão |
| 2026-03 | Módulo vagas, valores plantão |

### Detalhe — WhatsApp pausar/retomar (2026-07-30)

- **Quem controla:** apenas mensagens `IsFromMe` no WhatsApp da Viva Saúde (`pausar`, `retomar` / `despausar` / `ativar`)
- **Cliente:** não pausa/retoma; com conversa pausada o robô não responde
- **UX:** sem confirmação no chat; tenta apagar o comando (`/message/delete`)
- **Bug corrigido:** pause/resume usavam `@lid` como “telefone”; agora resolve PN + mapeia LID↔telefone no Redis
- **Arquivos:** `whatsapp-atendimento.service.ts`, `whatsapp-jid.util.ts`, `evolution-whatsapp.service.ts`, `evolution-webhook.routes.ts`, `docs/SETUP-EVOLUTION-GO.md`

### Detalhe — Relatórios / e-mail (2026-07-21)

- PDF com logo horizontal Viva Saúde (`utils/pdf-branding.ts`)
- Produção por médico → **Enviar demonstrativo** (prévia + anexo)
- Remetente operacional: `noreply@vivasaude.cloud`

*Adicione linhas na tabela ao fechar tarefas.*
