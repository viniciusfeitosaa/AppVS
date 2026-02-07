#!/bin/sh
set -e

echo "🚀 Iniciando aplicação..."

# Executar migrações do Prisma (apenas em produção)
if [ "$NODE_ENV" = "production" ]; then
  echo "📦 Executando migrações do Prisma..."
  set +e
  npx prisma migrate deploy 2>&1
  MIGRATE_EXIT=$?
  set -e
  if [ "$MIGRATE_EXIT" -eq 0 ]; then
    echo "✅ Migrações concluídas!"
  else
    # P3005 = banco já populado (baseline). Sem migrations = pasta não commitada no Git.
    echo "⚠️  Migrações não aplicadas (P3005/baseline ou pasta migrations vazia). Iniciando servidor."
    echo "   Para corrigir: commit/push de backend/prisma/migrations e 'npx prisma migrate resolve --applied 20250127000000_init' no Neon."
  fi
fi

# Iniciar a aplicação
echo "🌐 Iniciando servidor..."
exec node dist/server.js
