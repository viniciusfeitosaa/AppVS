# 🐳 Guia Docker - App Médico

## 📋 Estrutura Docker

O projeto utiliza Docker para containerização com a seguinte estrutura:

```
app-medico/
├── backend/
│   └── Dockerfile          # Build do backend Node.js
├── frontend/
│   ├── Dockerfile          # Build do frontend React
│   └── nginx.conf          # Configuração Nginx para frontend
├── docker/
│   └── nginx/
│       ├── nginx.conf      # Reverse proxy (produção)
│       └── ssl/            # Certificados SSL
└── docker-compose.yml       # Orquestração dos containers
```

## 🚀 Comandos Básicos

### Desenvolvimento Local

```bash
# Build e iniciar todos os containers
docker-compose up --build

# Rodar em background
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar containers
docker-compose down

# Parar e remover volumes
docker-compose down -v
```

### Rebuild após mudanças

```bash
# Rebuild específico de um serviço
docker-compose build backend
docker-compose build frontend

# Rebuild e restart
docker-compose up --build -d
```

## 🔧 Configuração

### Variáveis de Ambiente

Certifique-se de ter um arquivo `.env` na raiz do projeto com todas as variáveis necessárias (veja `.env.example`).

### Portas Padrão

- **Frontend**: `80` (HTTP)
- **Backend**: `3001`
- **Nginx**: `8080` (HTTP), `8443` (HTTPS) - apenas em produção

Para alterar, modifique as variáveis no `docker-compose.yml` ou no `.env`:

```env
FRONTEND_PORT=80
BACKEND_PORT=3001
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
```

## 🏗️ Estrutura dos Dockerfiles

### Backend Dockerfile

- **Multi-stage build** para otimização
- Usa Node.js 18 Alpine (imagem leve)
- Executa como usuário não-root (segurança)
- Health check configurado
- Gera Prisma Client durante o build

### Frontend Dockerfile

- **Multi-stage build**: Build com Node.js, serve com Nginx
- Nginx Alpine (imagem leve)
- Configuração otimizada para React Router
- Gzip compression habilitado
- Cache de assets estáticos

## 🔒 Segurança

### Boas Práticas Implementadas

1. ✅ Usuário não-root nos containers
2. ✅ Multi-stage builds (imagens menores)
3. ✅ Health checks configurados
4. ✅ Rate limiting no Nginx
5. ✅ Security headers
6. ✅ .dockerignore para não copiar arquivos desnecessários

## 📊 Health Checks

Todos os serviços possuem health checks:

```bash
# Verificar status dos containers
docker-compose ps

# Health check manual
curl http://localhost:3001/health  # Backend
curl http://localhost/health      # Frontend
```

## 🔄 Banco de Dados Externo

**IMPORTANTE**: O banco de dados PostgreSQL roda **FORA** do container Docker na VPS.

O container do backend se conecta ao banco externo via rede. Configure no `.env`:

```env
DATABASE_URL=postgresql://usuario:senha@IP_VPS:5432/app_medico
DB_HOST=IP_OU_HOSTNAME_VPS
```

## 🌐 Nginx Reverse Proxy

O Nginx está configurado como reverse proxy opcional para produção:

### Ativar Nginx (produção)

```bash
# Usar profile de produção
docker-compose --profile production up -d
```

### Configuração SSL

1. Coloque os certificados em `docker/nginx/ssl/`:
   - `fullchain.pem`
   - `privkey.pem`

2. Descomente as seções HTTPS no `docker/nginx/nginx.conf`

3. Reinicie o container:
   ```bash
   docker-compose restart nginx
   ```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker-compose logs [servico]

# Exemplo
docker-compose logs backend
docker-compose logs frontend
```

### Rebuild completo

```bash
# Remover tudo e reconstruir
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Verificar conectividade

```bash
# Testar conexão entre containers
docker-compose exec backend ping frontend
docker-compose exec frontend ping backend
```

### Limpar imagens antigas

```bash
# Remover imagens não utilizadas
docker system prune -a
```

## 📝 Notas Importantes

1. **Banco de dados**: Sempre externo ao Docker (segurança)
2. **Volumes**: Não há volumes persistentes configurados (banco é externo)
3. **SSL**: Configure SSL antes de colocar em produção
4. **Firewall**: Configure o firewall da VPS para permitir apenas conexões necessárias
5. **Backup**: Implemente backup automático do banco externo

## 🚀 Deploy em Produção

1. Configure todas as variáveis no `.env`
2. Configure SSL e descomente seções HTTPS no Nginx
3. Use `docker-compose --profile production up -d`
4. Configure firewall na VPS
5. Configure backup automático do banco
6. Configure monitoramento e logs

---

**Última atualização**: 27/01/2026
