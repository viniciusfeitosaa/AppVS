# 🏥 Viva Saúde - Sistema Profissional

Sistema completo para médicos com autenticação via CPF e CRM, dashboard personalizado e arquitetura segura.

## 📋 Sobre o Projeto

Aplicação profissional desenvolvida para médicos, com foco em segurança, conformidade com LGPD e arquitetura escalável.

### Características Principais

- ✅ Autenticação segura (CPF + CRM)
- ✅ Dashboard personalizado
- ✅ Arquitetura Docker
- ✅ Banco de dados externo (PostgreSQL)
- ✅ Conformidade LGPD
- ✅ Deploy em VPS

## 🏗️ Arquitetura

```
┌─────────────┐
│   Nginx     │ (Reverse Proxy + SSL)
└──────┬──────┘
       │
   ┌───┴───┬──────────────┐
   │       │              │
┌──▼──┐ ┌──▼──┐    ┌──────▼──────┐
│Front│ │Back │    │  PostgreSQL │
│end  │ │end  │    │  (EXTERNO)  │
└─────┘ └─────┘    └─────────────┘
```

## 🚀 Tecnologias

### Frontend
- React / Next.js
- TypeScript
- Tailwind CSS
- React Query
- React Router

### Backend
- Node.js
- Express / NestJS
- TypeScript
- Prisma ORM
- JWT Authentication

### Infraestrutura
- Docker & Docker Compose
- Nginx
- PostgreSQL (externo)
- VPS

## 📁 Estrutura do Projeto

```
app-medico/
├── frontend/          # Aplicação React/Next.js
├── backend/           # API Node.js
├── docker/            # Configurações Docker
├── PLANO_PROJETO.md   # Plano detalhado
└── GUIA_IMPLEMENTACAO.md # Guia passo a passo
```

## 🔐 Segurança

- Criptografia de dados sensíveis
- JWT com refresh tokens
- Rate limiting
- Validação rigorosa de inputs
- Logs de auditoria
- Conformidade LGPD

## 📚 Documentação

- [PLANO_PROJETO.md](./PLANO_PROJETO.md) - Plano completo do projeto
- [GUIA_IMPLEMENTACAO.md](./GUIA_IMPLEMENTACAO.md) - Guia de implementação passo a passo

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (na VPS)

### Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd app-medico

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Inicie os containers
docker-compose up -d
```

## 📝 Status do Projeto

- [x] Planejamento
- [ ] Setup inicial
- [ ] Autenticação
- [ ] Dashboard
- [ ] Deploy

## 📄 Licença

[Definir licença]

## 👥 Contribuição

[Instruções de contribuição]

---

**Desenvolvido com foco em segurança e profissionalismo** 🏥
