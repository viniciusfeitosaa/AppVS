# 01 — Produto e visão

**Status:** ✅ Estável (conceito)  
**Última atualização:** 2026-08-14

## O que é

**Viva Saúde** — plataforma B2B para gestão de corpo clínico em serviços de saúde:

- Médicos registram **ponto eletrônico** (com geolocalização quando configurado)
- Gestores (**MASTER**) administram escalas, plantões, contratos, valores e documentação
- Módulos opcionais por perfil (matriz de acesso por `ModuloSistema`)
- Multi-tenant via modelo `Tenant` no banco

## Personas

| Persona | Papel (`UserRole`) | Uso principal |
|---------|-------------------|---------------|
| Médico | `MEDICO` | Ponto, calendário de plantões, documentos, vagas, perfil |
| Gestor / admin clínico | `MASTER` | Médicos, escalas, contratos, relatórios, configurações |
| Staff / escalista | `MASTER` (com perfil) | Conta e-mail/senha como admin, restrita por perfil customizado (ex.: só Escalas em VER ou EDITAR); não gerencia perfis nem configurações globais |
| Visitante | — | Landing, cadastro público, política de privacidade |

**Staff (escalista etc.):** o administrador pleno cria perfis nomeados (ex.: “Escalista”) com nível por módulo (`OFF` / `VER` / `EDITAR`) e vincula usuários staff em **Perfis e equipe** (`/perfis-equipe`). O escalista enxerga apenas os módulos liberados — tipicamente Escalas para montar plantões — sem acesso pleno a Configurações ou gestão de outros admins. Médicos (`MEDICO`) e a matriz MASTER/MEDICO em Minha Conta não mudam; staff resolve permissões pelo perfil customizado.

## Domínios de negócio (módulos)

Alinhados ao enum `ModuloSistema` no Prisma:

- Dashboard, Médicos, Contratos ativos, Escalas, Valores plantão
- Relatórios, Ponto eletrônico, Atendimentos (placeholder no front)
- Vagas, Configurações, Envio de documentos, Avaliação, Perfil

## Fora de escopo (por enquanto)

- Prontuário eletrônico completo (rota `/atendimentos` é placeholder)
- Marketplace genérico de vagas fora do tenant

## Decisões de produto registradas

1. Login separado: e-mail (admin), médico (CPF/CRM ou fluxo específico), master
2. Uploads **não** são públicos — download via rotas autenticadas
3. LGPD: landing com política de privacidade; auditoria no backend (`Auditoria`)

## Referências no repo

- `landing/` — site institucional estático
- `frontend/src/pages/` — telas da aplicação
- `backend/prisma/schema.prisma` — modelo de domínio
