# 09 — Documentos

**Status:** ✅ Implementado (+ DocuSeal nº automático no termo)  
**Última atualização:** 2026-09-04

## Tipos

### Documentos de perfil do médico

Enum `DocumentoPerfilTipo` (CRM, diploma, RQE, PIX, etc.) — modelo `MedicoDocumento`.

### Documentos enviados (fluxo administrativo)

- `DocumentoEnviado` — upload pelo master, aceite pelo médico
- Campo `aceitoEm` (migration `documento_enviado_aceito_em`)
- `documentosenviados.service.ts`, `documentos.const.ts`

## Integração DocuSeal

- `docuseal.service.ts` — quando `DOCUSEAL_*` configurado no env
- Painel Médicos: status por template obrigatório; 2.ª parte; OTP configurável
- **Número automático (termo de transferência):** ao criar submissão, preenche `Campo de Número 1` no formato `AAAA/000123`
  - Contador: tabela `docuseal_documento_contadores` (migration `20260904170000_docuseal_documento_contador`)
  - Env: `DOCUSEAL_NUMERO_FIELD_NAME`, `DOCUSEAL_TERMO_NUMERO_SEED`, `DOCUSEAL_TERMO_TRANSFERENCIA_TEMPLATE_IDS`, `autoNumero` no JSON de templates
  - Util: `docuseal-documento-contador.util.ts`

## Upload

- Middleware `upload.middleware.ts`
- Path seguro: `upload-path.util.ts` (+ testes)
- Validação magic bytes de imagem: `image-magic-bytes.util.ts`

## Rotas

**Médico:** `/api/medico/documentos-enviados` (listar, upload próprio onde aplicável)

**Admin:** `/api/admin/documentos-enviados` (módulo `ENVIO_DOCUMENTOS`)

## Frontend

- `EnvioDocumentos.tsx` — envio (gestão)
- `MeusDocumentos.tsx` — médico visualiza/aceita
- `Medicos.tsx` — painel DocuSeal (enviar / assinar / 2.ª parte)

## Changelog

### 2026-09-04 — Número automático no termo de transferência
- Prefill do campo `Campo de Número 1` (text) no envio; formato `2026/000123`; seed 592
- Só termo de transferência; contrato de adesão sem número
- Arquivos: `docuseal.service.ts`, `docuseal-documento-contador.util.ts`

### 2026-09-01 — Status DocuSeal mais confiável
- Cache/resumo por e-mail; prioriza submissão concluída; menos varredura global

## Pendências

- [ ] Atualizar este doc quando novos tipos de documento forem adicionados ao enum
