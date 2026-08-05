# 15 — Estado atual e pendências

**Snapshot:** 2026-08-05  
**Branch:** `main` (sync com `origin/main` após push desta entrega)

> Este arquivo deve ser o **primeiro** atualizado após entregas relevantes.  
> É o **mapa de bordo** do projeto (o que está pronto, o que falta, histórico recente).

## Resumo executivo

O **Viva Saúde** está em produção na VPS (`sejavivasaude.com.br`). Auth, escalas, ponto, vagas, documentos, relatórios, painel de e-mail, robô WhatsApp (Evolution GO), mobile e deploy estão implementados.  
**Conteúdos / eventos** inclui anúncio, inscrição (médico/estudante + CPF), frequência na aula e **pipeline de precadastro → aceite → cadastro ATIVO no corpo clínico (sem Avaliação)**.

## Módulos — status

| Módulo | Backend | Frontend | Notas |
|--------|---------|----------|-------|
| Auth / cadastro | ✅ | ✅ | 3 fluxos de login; `/cadastro` → Avaliação |
| Dashboard | ✅ | ✅ | |
| Médicos | ✅ | ✅ | Convites, status cadastro; ATIVO via convite **ou** precadastro aceito |
| Contratos | ✅ | ✅ | |
| Escalas / plantões | ✅ | ✅ | Trocas; **multi-escala no mesmo mês** (ver abaixo) |
| Valores plantão/ponto | ✅ | ✅ | Por contrato/escala |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico; seletor de escala |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Procedimentos + ponto; PDF com logo VS |
| Painel de E-mail | ✅ | ✅ | NF / demonstrativos com PDF anexo + 2 tipos de competência |
| WhatsApp (Evolution GO) | ✅ | — | Menu atendimento; pausar/retomar (equipe) |
| Conteúdos / eventos | ✅ | ✅ | Anúncio, frequência, precadastro→aceite→corpo clínico — `17-conteudos-eventos.md` |
| Configurações / módulos | ✅ | ✅ | Matriz de acesso |
| Avaliação (master) | ✅ | ✅ | Só cadastro público `/cadastro` (não precadastro aceito) |
| Atendimentos | — | ⏳ Placeholder | `FeaturePlaceholder` |
| Landing | ✅ | ✅ | + pasta `landing/` |

## Confirmação de regra de negócio — multi-escala / multi-contrato

**Pergunta (2026-08-04):** médico pode trabalhar no mesmo mês em mais de uma escala de contratos diferentes (ex.: UPA São Miguel noite + UPInha Infantil manhã) e o sistema ainda calcula quanto recebe?

**Resposta: SIM — já suportado.**

| Aspecto | Comportamento |
|---------|----------------|
| Modelo | `Escala` → 1 `contratoAtivoId`; médico em N escalas via `EscalaMedico` / plantões / ponto |
| Mesmo mês | Sem unique "1 contrato ou 1 escala por médico por mês" |
| Valor | Por escala/contrato: `EscalaMedico.valorHora`, plantão, `ValorPlantao` do contrato, `repasseValorCongelado` no ponto |
| Relatório | Agrupa por **médico + escala** (`medicoId::escalaId`) e soma repasses |
| Operação | Precisa alocar o médico em cada escala e registrar plantão/ponto na escala correta |
| Limitação | Não valida conflito de horário **entre** escalas/contratos diferentes; ponto tem 1 `escalaId` por registro |

Arquivos de referência: `schema.prisma` (`Escala`, `EscalaMedico`, `EscalaPlantao`, `ValorPlantao`, `RegistroPonto`), `repasse-registro-ponto.service.ts`, `Relatorios.tsx`, `PontoEletronico.tsx`.

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
- Conteúdos: evoluções opcionais em `17-conteudos-eventos.md` (OTP frequência, docs no cadastro-corpo)

## Histórico de entregas recentes

| Data | Entrega |
|------|---------|
| 2026-08-05 | Conteúdos: **aceite de precadastro** → e-mail + cadastro `ATIVO` (**sem Avaliação**) — opção A; mapa de bordo |
| 2026-08-05 | Conteúdos: popup detalhe precadastro; **excluir** participante/precadastro |
| 2026-07-31 | Conteúdos: CPF no palestrante; sem URL de foto no form |
| 2026-08-04 | WhatsApp: **pausar** sem expirar em 24h — só volta com `retomar` |
| 2026-08-04 | Painel de E-mail → **Demonstrativos** com PDF; 2 competências |
| 2026-08-04 | Confirmação **multi-escala/multi-contrato no mesmo mês** |
| 2026-07-31 | Conteúdos: **frequência** na aula + perfil médico/estudante/CPF — `17` |
| 2026-07-30 | Conteúdos: anúncio sem YouTube; WhatsApp pausar/retomar equipe |
| 2026-07-21 | Logo VS PDFs; ícone PWA VS |
| 2026-07 | Painel e-mail, Evolution GO |
| 2026-04 | Trocas de plantão |
| 2026-03 | Módulo vagas, valores plantão |

### Detalhe — Conteúdos: precadastro → corpo clínico (2026-08-05)

**Decisão:** precadastro **não** é corpo clínico. Aceite da equipe **substitui** Avaliação (opção A).

| Passo | O quê |
|-------|--------|
| 1 | Externo se inscreve no conteúdo → `ConteudoParticipante` `origem=EXTERNO` |
| 2 | Aparece em **Precadastros** (status `AGUARDANDO`) |
| 3 | Master seleciona um/todos → **Aceitar** → e-mail + `ACEITO` + `tokenCadastroCorpo` |
| 4 | Link `/conteudos/cadastro-corpo/:token` completa dados (senha, profissão, faltantes) |
| 5 | Cria `Medico` **`ATIVO` + `ativo=true`** → status `CONVERTIDO` |

**Vs Avaliação**

| Origem | Após preencher dados |
|--------|----------------------|
| Precadastro **aceito** pela equipe | `ATIVO` na hora — **não** lista em Avaliação |
| Cadastro público `/cadastro` | `PENDENTE_ANALISE` — **vai** para Avaliação |
| Convite admin (`/ativar-conta`) | `ATIVO` na hora (já existia) |

**UI admin (Precadastros):** checkbox, selecionar todos, Aceitar, popup de dados, badges, Excluir.

**Migration:** `20260805153000_conteudo_precadastro_aceite`

**Arquivos:** `conteudo.service.ts`, `cadastro-publico-email.service.ts`, rotas admin/public, `ConteudosAdminPage.tsx`, `ConteudoCadastroCorpoPublicPage.tsx`, `contexto/17-conteudos-eventos.md`

### Detalhe — Demonstrativos no Painel de E-mail (2026-08-04)

Espelha o fluxo de produção/NF: copiar tabela → e-mail individual + PDF anexo. Ver componentes em `frontend/src/modules/email/`.

### Detalhe — WhatsApp pausar/retomar (2026-07-30)

- **Quem controla:** apenas mensagens `IsFromMe` no WhatsApp da Viva Saúde
- **Pausa permanente** até `retomar` / `despausar` / `ativar` (sem TTL 24h)
- **Arquivos:** `whatsapp-atendimento.service.ts`, `whatsapp-jid.util.ts`, `evolution-whatsapp.service.ts`

*Adicione linhas na tabela ao fechar tarefas.*
