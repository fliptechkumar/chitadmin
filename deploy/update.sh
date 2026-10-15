#!/usr/bin/env bash
# Pull the latest code, apply migrations, rebuild and restart.
# Run as the app user:  su - chit -c "bash app/deploy/update.sh"
set -euo pipefail
cd "$(dirname "$0")/.."

# Node and PM2 live in this user's nvm, not the system.
. "$HOME/.nvm/nvm.sh"

PORT=$(grep '^APP_PORT=' .env | cut -d= -f2)
PORT=${PORT:-3100}

git pull --ff-only
npm ci
npx prisma migrate deploy
npm run build

# One process on purpose: the login lockout counts failures in memory.
if pm2 describe chit-admin >/dev/null 2>&1; then
  pm2 restart chit-admin
else
  pm2 start npm --name chit-admin -- start -- -p "$PORT"
fi
pm2 save
echo "App is running on port $PORT. Logs: pm2 logs chit-admin"
