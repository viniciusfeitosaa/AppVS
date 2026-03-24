# Dockerfile para Frontend
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# URL pública da API (vista pelo browser). Ex.: http://187.77.247.33:3001/api ou https://api.teudominio.com/api
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "Defina VITE_API_URL no .env na raiz do projeto (ex.: http://IP_OU_DOMINIO:3001/api) e faça docker compose build" >&2 && exit 1)

RUN npm run build

# Stage 2: Production
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do nginx (se existir)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Nginx inicia automaticamente
CMD ["nginx", "-g", "daemon off;"]
