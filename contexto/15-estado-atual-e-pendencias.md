# 15 — Estado atual e pendências

**Snapshot:** 2026-08-04  
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
| Escalas / plantões | ✅ | ✅ | Trocas; **multi-escala no mesmo mês** (ver abaixo) |
| Valores plantão/ponto | ✅ | ✅ | Por contrato/escala |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico; seletor de escala |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Procedimentos + ponto; PDF com logo VS |
| Painel de E-mail | ✅ | ✅ | NF / demonstrativos com PDF anexo + 2 tipos de competência |
| WhatsApp (Evolution GO) | ✅ | — | Menu atendimento; pausar/retomar (equipe) |
| Conteúdos / eventos | ✅ | ✅ | Anúncio + inscrições; frequência v1 (admin + app + e-mail) |
| Configurações / módulos | ✅ | ✅ | Matriz de acesso |
| Avaliação (master) | ✅ | ✅ | `MasterOnly` |
| Atendimentos | — | ⏳ Placeholder | `FeaturePlaceholder` |
| Landing | ✅ | ✅ | + pasta `landing/` |

## Confirmação de regra de negócio — multi-escala / multi-contrato

**Pergunta (2026-08-04):** médico pode trabalhar no mesmo mês em mais de uma escala de contratos diferentes (ex.: UPA São Miguel noite + UPInha Infantil manhã) e o sistema ainda calcula quanto recebe?

**Resposta: SIM — já suportado.**

| Aspecto | Comportamento |
|---------|----------------|
| Modelo | `Escala` → 1 `contratoAtivoId`; médico em N escalas via `EscalaMedico` / plantões / ponto |
| Mesmo mês | Sem unique “1 contrato ou 1 escala por médico por mês” |
| Valor | Por escala/contrato: `EscalaMedico.valorHora`, plantão, `ValorPlantao` do contrato, `repasseValorCongelado` no ponto |
| Relatório | Agrupa por **médico + escala** (`medicoId::escalaId`) e soma repasses |
| Operação | Precisa alocar o médico em cada escala e registrar plantão/ponto na escala correta |
| Limitação | Não valida conflito de horário **entre** escalas/contratos diferentes; ponto tem 1 `escalaId` por registro |

Arquivos de referência: `schema.prisma` (`Escala`, `EscalaMedico`, `EscalaPlantao`, `ValorPlantao`, `RegistroPonto`), `repasse-registro-ponto.service.ts`, `Relatorios.tsx` (horas por médico e escala), `PontoEletronico.tsx` (seletor de escala).

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
- Detalhar multi-escala em `06-escalas-plantoes.md` (já confirmado no código; falta doc dedicada)

## Histórico de entregas recentes

| Data | Entrega |
|------|---------|
| 2026-08-04 | Painel de E-mail → **Demonstrativos** com PDF (tabela colada); 2 competências; corpo sem valores |
| 2026-08-04 | Confirmação **multi-escala/multi-contrato no mesmo mês** + cálculo de repasse (mapa de bordo) |
| 2026-07-31 | Conteúdos: CPF também no **cadastro do palestrante** (link público) |
| 2026-07-31 | Conteúdos: **frequência** na aula (admin abre/fecha; médico no app; externo por e-mail) — `17-conteudos-eventos.md` |
| 2026-07-30 | Conteúdos: modelo **anúncio** — abrir inscrições sem YouTube; copy admin/médico (ver `17-conteudos-eventos.md`) |
| 2026-07-30 | Robô WhatsApp: `pausar`/`retomar` **só pela equipe** (silencioso + apaga comando); fix retomar com JID `@lid` ↔ telefone; `readMessages=false` |
| 2026-07-21 | Logo VS nos PDFs; enviar demonstrativo da produção (prévia + PDF anexo); contatos/e-mails médicos; ícone PWA VS |
| 2026-07 | Painel de e-mail (NF/demonstrativos), Evolution GO, filtro produção por médico |
| 2026-04 | Trocas de plantão |
| 2026-03 | Módulo vagas, valores plantão |

### Detalhe — Demonstrativos no Painel de E-mail (2026-08-04)

Espelha o fluxo de produção/NF: copiar tabela → e-mail individual + PDF anexo.

**Fluxo**
1. Novo e-mail → **Demonstrativos**
2. Escolher competência (ver abaixo)
3. Colar tabela: `Nome · e-mail · onde trabalhou · valor` (opcional coluna total)
4. Prévia → **Enviar … com PDF** (`POST /email/mensagens/enviar-agora` com `anexos`)

**Competência (2 estilos)**
| Tipo | Exemplo | UI |
|------|---------|-----|
| Mês e ano | agosto de 2026 | selects mês/ano |
| Período (datas) | 15/06/2026 a 14/07/2026 | date inputs; default 15 mês ant. → 14 mês atual |

Assunto, corpo e linha “Competência” do PDF usam o estilo escolhido.

**Corpo do e-mail**
- Texto curto (saudação + “Segue em anexo…” + “**Ficamos** à disposição…”)
- **Sem** lista de valores/total no corpo — valores só no PDF

**PDF**
- Colunas: Nome | Onde trabalhou | Valor | **Total** (único, na última linha)
- Header: Competência + profissional + logo VS

**Parser** (`parse-demonstrativo-tabela.util.ts`)
- Agrupa por e-mail; soma valores das linhas
- Com colunas Valor+Total: usa o valor da linha (não some a coluna Total de novo)
- Aceita horas estilo NF + `R$` na mesma linha ou valor na linha seguinte
- Aceita várias linhas do mesmo profissional (vários locais)

**Arquivos**
- `frontend/src/modules/email/components/DemonstrativosModal.tsx`
- `frontend/src/modules/email/components/EmailComposeForm.tsx`
- `frontend/src/modules/email/components/EmailNfBatchPreview.tsx`
- `frontend/src/modules/email/pages/EmailPainelPage.tsx` (envio via `enviarAgora` p/ anexos)
- `frontend/src/modules/email/utils/email-demonstrativo-template.util.ts`
- `frontend/src/modules/email/utils/parse-demonstrativo-tabela.util.ts`
- `frontend/src/modules/email/utils/build-demonstrativo-pdf.util.ts`

**Deploy:** rebuild `coopvitta-frontend` na VPS após merge.

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
