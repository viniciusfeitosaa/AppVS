#!/bin/sh
set -e

echo "🚀 Iniciando aplicação..."

# Executar migrações do Prisma (apenas em produção)
if [ "$NODE_ENV" = "production" ]; then
  echo "📦 Executando migrações do Prisma..."
  npx prisma migrate deploy
  echo "✅ Migrações concluídas!"
fi

# Iniciar a aplicação
echo "🌐 Iniciando servidor..."
exec node dist/server.js
