#!/usr/bin/env bash
# One-time setup of the chit admin app on an Ubuntu VPS — including one that
# already runs other projects. It does not upgrade system packages, replace the
# system Node, enable the firewall, or touch other Nginx sites or databases.
#
# Run as root:
#   bash setup-server.sh <domain> <email-for-ssl> [path-to-db-dump]
#
# Example:
#   bash setup-server.sh michits.in you@example.com /root/chit_admin.dump
#
# What it sets up, all separate from anything already on the server:
#   - a "chit" Linux user, with its own Node 22 (nvm) and its own PM2
#   - a PostgreSQL 18 cluster (on 5432, or the next free port if that is taken)
#   - the app on APP_PORT (default 3100), behind an Nginx site for <domain>
#   - an SSL certificate and a daily database backup
# Safe to re-run: steps already done are skipped.
set -euo pipefail

DOMAIN="${1:?Usage: setup-server.sh <domain> <email> [dump]}"
EMAIL="${2:?Usage: setup-server.sh <domain> <email> [dump]}"
DUMP="${3:-}"
APP_PORT="${APP_PORT:-3100}"
REPO="https://github.com/fliptechkumar/chitadmin.git"
APP_USER="chit"
APP_HOME="/home/$APP_USER"
APP_DIR="$APP_HOME/app"
ENV_FILE="$APP_DIR/.env"
DB_NAME="chit_admin"
DB_USER="chit_admin"
PG_BIN="/usr/lib/postgresql/18/bin"

# A bare domain (michits.in) also serves its www. name.
if [ "$(echo "$DOMAIN" | tr -cd '.' | wc -c)" -eq 1 ]; then
  NAMES="$DOMAIN www.$DOMAIN"
else
  NAMES="$DOMAIN"
fi

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
step() { echo; echo "==> $*"; }

step "Checks"
if [ ! -f "$ENV_FILE" ] && ss -ltn "( sport = :$APP_PORT )" | grep -q LISTEN; then
  echo "Port $APP_PORT is already used by another program. Re-run with a free one, e.g.:"
  echo "  APP_PORT=3200 bash $0 $*"
  exit 1
fi
if grep -RqsE "server_name[^;]*\b$DOMAIN\b" /etc/nginx/sites-enabled/ --exclude=chit-admin; then
  echo "Another Nginx site already uses $DOMAIN:"
  grep -RlsE "server_name[^;]*\b$DOMAIN\b" /etc/nginx/sites-enabled/ --exclude=chit-admin
  echo "Remove $DOMAIN from that site first, so the two do not conflict."
  exit 1
fi

step "Packages (install only — nothing is upgraded)"
apt-get update -y
apt-get install -y git nginx curl openssl postgresql-common certbot python3-certbot-nginx

# Only add rules if a firewall is already on; never switch one on.
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 'Nginx Full'
fi

step "PostgreSQL 18"
if [ ! -x "$PG_BIN/postgres" ]; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt-get install -y postgresql-18
fi
pg_lsclusters 18 main >/dev/null 2>&1 || pg_createcluster 18 main --start
pg_ctlcluster 18 main start 2>/dev/null || true
PGPORT=$(pg_lsclusters -h 18 main | awk '{print $3}')
echo "PostgreSQL 18 is on port $PGPORT"
# Modest tuning: the server is shared with another project.
cat > /etc/postgresql/18/main/conf.d/chit.conf <<'EOF'
shared_buffers = 2GB
effective_cache_size = 8GB
work_mem = 16MB
maintenance_work_mem = 256MB
EOF
pg_ctlcluster 18 main restart
psql18() { sudo -u postgres "$PG_BIN/psql" -p "$PGPORT" "$@"; }

step "Database"
if [ -f "$ENV_FILE" ]; then
  echo "Existing .env found — keeping its database password and AUTH_SECRET."
  DB_PASS=$(grep '^DATABASE_URL' "$ENV_FILE" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')
else
  DB_PASS=$(openssl rand -hex 24)
fi
if ! psql18 -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  psql18 -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
fi
if ! psql18 -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  psql18 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  if [ -n "$DUMP" ]; then
    step "Restoring $DUMP"
    cp "$DUMP" /tmp/chit_restore.dump && chmod 644 /tmp/chit_restore.dump
    sudo -u postgres "$PG_BIN/pg_restore" -p "$PGPORT" --no-owner --role="$DB_USER" -d "$DB_NAME" /tmp/chit_restore.dump
    rm /tmp/chit_restore.dump
  fi
else
  echo "Database exists — not restoring (drop it first to re-import)."
fi

step "App user, Node 22 and PM2 (private to $APP_USER)"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
sudo -iu "$APP_USER" bash <<'EOF'
set -e
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
. "$HOME/.nvm/nvm.sh"
nvm install 22 >/dev/null
nvm alias default 22 >/dev/null
command -v pm2 >/dev/null || npm i -g pm2
EOF
NODE_BIN=$(sudo -iu "$APP_USER" bash -c '. ~/.nvm/nvm.sh >/dev/null; dirname "$(command -v node)"')

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning $REPO (for a private repo, enter your GitHub username and a personal access token)."
  sudo -iu "$APP_USER" git clone "$REPO" "$APP_DIR"
fi

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:$PGPORT/$DB_NAME?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
APP_PORT=$APP_PORT
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
APP_PORT=$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)

step "Build and start"
sudo -iu "$APP_USER" bash "$APP_DIR/deploy/update.sh"
# Its own systemd unit (pm2-chit), so it never touches another user's PM2.
env PATH="$PATH:$NODE_BIN" "$NODE_BIN/pm2" startup systemd -u "$APP_USER" --hp "$APP_HOME" >/dev/null

step "Nginx site for $NAMES"
sed -e "s/__DOMAIN__/$NAMES/" -e "s/__PORT__/$APP_PORT/" "$APP_DIR/deploy/nginx.conf" \
  > /etc/nginx/sites-available/chit-admin
ln -sf /etc/nginx/sites-available/chit-admin /etc/nginx/sites-enabled/chit-admin
nginx -t && systemctl reload nginx

step "SSL certificate"
certbot --nginx $(printf -- '-d %s ' $NAMES) -m "$EMAIL" --agree-tos --non-interactive --redirect

step "Daily database backup (03:00, kept 14 days)"
mkdir -p /var/backups/chit && chown postgres /var/backups/chit
cat > /etc/cron.d/chit-backup <<EOF
0 3 * * * postgres $PG_BIN/pg_dump -p $PGPORT -Fc $DB_NAME -f /var/backups/chit/chit-\$(date +\%F).dump && find /var/backups/chit -name '*.dump' -mtime +14 -delete
EOF

echo
echo "Done. Open https://$DOMAIN  (app on port $APP_PORT, PostgreSQL 18 on port $PGPORT)"
