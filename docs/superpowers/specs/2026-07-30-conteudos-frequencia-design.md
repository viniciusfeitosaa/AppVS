# Design: Frequência em aulas ao vivo (Conteúdos)

**Data:** 2026-07-30  
**Status:** aprovado — implementado (v1)  
**Módulo:** Conteúdos / eventos (`contexto/17-conteudos-eventos.md`)

## Problema

Durante a aula ao vivo, a equipe precisa registrar **presença** dos inscritos e ter confiança de que quem bateu frequência é a **mesma pessoa da inscrição** — sem tratar o conteúdo como um “post” já com vídeo pronto.

## Decisões fechadas

| Tema | Decisão |
|------|---------|
| Quem marca | Todos na **lista de inscritos** (médico app + precadastro externo) |
| Janela | **Admin abre/fecha** manualmente (“Abrir frequência” / “Encerrar frequência”) |
| Identidade médico | **Login no app** basta (já inscrito → botão confirmar) |
| Identidade externo | **Mesmo e-mail da inscrição** na página pública de frequência |
| Segredo extra (código) | **Não** na v1 — usa o cadastro já feito |
| Quantidade | **Uma** presença por inscrito por evento |

## Fluxo

```text
[Admin] Abrir frequência
    → evento.frequenciaAberta = true
    → link + QR: /conteudos/frequencia/{tokenFrequencia}

[Médico logado, inscrito]
    → detalhe do conteúdo no app → "Confirmar presença"
    → POST autenticado → presenteEm = now()

[Externo inscrito]
    → abre link/QR → informa e-mail
    → se e-mail ∈ inscritos do evento e frequência aberta
    → presenteEm = now()

[Admin] Encerrar frequência
    → não aceita novas confirmações
```

## Modelo de dados

### `ConteudoEvento` (campos novos)

- `tokenFrequencia` `String` unique — link público da página de frequência (sempre existe; só aceita check-in se aberta)
- `frequenciaAberta` `Boolean` default `false`
- `frequenciaAbertaEm` / `frequenciaFechadaEm` `DateTime?` — auditoria

### `ConteudoParticipante` (campos novos)

- `presenteEm` `DateTime?` — null = faltou / não confirmou; preenchido = presente
- (opcional) `presencaOrigem` enum `APP | LINK_PUBLICO` — de onde veio a confirmação

Índice útil: `(eventoId, email)` já existe; lookup de presença externa por e-mail normalizado (trim + lower).

## APIs

### Admin (MASTER)

- `POST /api/admin/conteudos/eventos/:id/frequencia/abrir` — seta aberta + devolve `linkFrequencia`
- `POST /api/admin/conteudos/eventos/:id/frequencia/fechar`
- Lista de participantes já existente passa a exibir `presenteEm` / badge Presente|Ausente
- Contadores: inscritos / presentes / ausentes (enquanto ou após a janela)

### Médico (autenticado)

- `POST /api/conteudos/eventos/:id/presenca`  
  Regras: evento `PUBLICADO` (ou ainda consultável), `frequenciaAberta`, usuário inscrito (`medicoId`), `presenteEm` ainda null → seta agora.  
  Idempotente: se já presente, 200 com a mesma data.

### Público (token)

- `GET /api/conteudos/public/frequencia/:token` — metadados mínimos (título, se aberta); se fechada, mensagem clara
- `POST /api/conteudos/public/frequencia/:token` body `{ email }`  
  Regras: frequência aberta; e-mail casa com um `ConteudoParticipante` do evento; seta `presenteEm`.  
  Respostas genéricas em falha (“Não foi possível confirmar”) para não enumerar e-mails demais; rate limit no endpoint.

## UI

### Admin

- Na edição do evento (status com inscrições abertas ou durante a aula): bloco **Frequência**
  - Botões Abrir / Encerrar
  - Link + Copiar + QR (quando aberta)
  - Lista: coluna Presente / horário

### Médico

- Detalhe do conteúdo: se inscrito e frequência aberta → CTA **Confirmar presença**; se já confirmou → “Presença registrada às …”

### Público

- Página simples: título da aula + campo e-mail + Confirmar  
- Estados: fechada / sucesso / e-mail não inscrito ou erro genérico

## Fora de escopo (v1)

- Código numérico / OTP
- Múltiplos check-ins na mesma aula
- Notificação push/e-mail automática ao abrir frequência
- Geo / foto (diferente do ponto eletrônico de plantão)
- Converter precadastro em usuário só para marcar presença

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Alguém digita e-mail de outro inscrito | Aceito na v1 (simplicidade); rate limit + janela curta controlada pelo admin; evolução futura: link pessoal ou OTP |
| Médico não logado tenta o link | Pode usar e-mail do cadastro no link público (mesmo fluxo do externo) se o e-mail estiver na lista |
| Frequência esquecida aberta | Admin fecha manualmente; UI destaque “Frequência aberta” |

## Critérios de sucesso

1. Admin abre frequência e copia o link em &lt; 10 s  
2. Médico inscrito confirma no app sem código  
3. Externo confirma com o e-mail da inscrição  
4. Após fechar, novos POSTs são rejeitados  
5. Admin vê quem está presente na lista
