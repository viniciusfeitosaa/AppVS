#!/bin/sh
set -e

# Comandos one-shot (ex.: docker compose run backend npx prisma db seed)
# Sem isto, o Docker passava "npx ..." ao script e o servidor iniciava na mesma.
if [ "$#" -gt 0 ]; then
  case "$1" in
    npx|node|sh)
      exec "$@"
      ;;
  esac
fi

echo "🚀 Iniciando aplicação..."

echo "📦 Executando migrações do Prisma..."
set +e
npx prisma migrate deploy 2>&1
MIGRATE_EXIT=$?
set -e
if [ "$MIGRATE_EXIT" -eq 0 ]; then
  echo "✅ Migrações concluídas!"
else
  echo "⚠️  Migrações não aplicadas (P3005/baseline ou pasta migrations vazia). Iniciando servidor."
  echo "   Verifique backend/prisma/migrations e a DATABASE_URL."
fi

echo "🌐 Iniciando servidor..."
exec node dist/server.js
