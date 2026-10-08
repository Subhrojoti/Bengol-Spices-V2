#!/usr/bin/env bash
# =====================================================================
#  Bengol Spices - one-time VPS preparation (Ubuntu / Debian)
#
#  Run ONCE on the Hostinger VPS as root:
#      bash vps-setup.sh
#
#  Safe to run again: every step checks before it changes anything.
#  It does NOT copy the app - deploy/push.sh does that.
# =====================================================================
set -euo pipefail

WEB_ROOT="/var/www/bengolspices"
API_ROOT="/var/www/bengol-api"
LOG_DIR="/var/log/bengol-api"
NODE_MAJOR="22"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[0;32mok\033[0m  %s\n' "$*"; }
warn(){ printf '    \033[0;33m!!\033[0m  %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash vps-setup.sh"; exit 1; }

# ---------------------------------------------------------------------
say "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw ripgrep >/dev/null 2>&1 || \
  apt-get install -y -qq curl ca-certificates gnupg git ufw >/dev/null
ok "base packages present"

# ---------------------------------------------------------------------
say "Node.js ${NODE_MAJOR}.x"
CURRENT_NODE="$(node -v 2>/dev/null || echo none)"
NEEDS_NODE=1
if [ "$CURRENT_NODE" != "none" ]; then
  MAJOR="$(echo "$CURRENT_NODE" | sed 's/^v\([0-9]*\).*/\1/')"
  # mongoose 9 + express 5 need Node 20+; 20 or newer is fine
  if [ "$MAJOR" -ge 20 ] 2>/dev/null; then NEEDS_NODE=0; fi
fi
if [ "$NEEDS_NODE" -eq 1 ]; then
  warn "found Node ${CURRENT_NODE}, installing ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------------
say "PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2 >/dev/null
fi
ok "pm2 $(pm2 -v)"

# ---------------------------------------------------------------------
say "nginx"
if ! command -v nginx >/dev/null 2>&1; then
  apt-get install -y -qq nginx >/dev/null
fi
systemctl enable nginx >/dev/null 2>&1 || true
ok "nginx $(nginx -v 2>&1 | sed 's|nginx version: ||')"

# ---------------------------------------------------------------------
say "Directories"
mkdir -p "$WEB_ROOT" "$API_ROOT" "$LOG_DIR"
chown -R www-data:www-data "$WEB_ROOT"
ok "$WEB_ROOT, $API_ROOT, $LOG_DIR"

# ---------------------------------------------------------------------
# A leftover node from an earlier hand-started deploy will hold :8000 and
# make every new start fail with EADDRINUSE. Clear anything PM2 does not own.
say "Port 8000"
if command -v ss >/dev/null 2>&1 && ss -ltnp 2>/dev/null | grep -q ':8000'; then
  HOLDER="$(ss -ltnp 2>/dev/null | grep ':8000' | head -1)"
  warn "in use: $HOLDER"
  if ! pm2 pid bengol-api >/dev/null 2>&1; then
    warn "not a PM2 process, stopping the stray listener"
    fuser -k 8000/tcp >/dev/null 2>&1 || true
    sleep 1
  fi
fi
ok "port 8000 ready"

# ---------------------------------------------------------------------
say "nginx sites"
# Hostinger images ship a 'default' site that answers on port 80 first and
# hides the real ones. Remove the symlink, keep the file.
if [ -L /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
  warn "disabled nginx default site"
fi

install -m 644 nginx/bengolspices.com.conf     /etc/nginx/sites-available/bengolspices.com.conf
install -m 644 nginx/api.bengolspices.com.conf /etc/nginx/sites-available/api.bengolspices.com.conf
ln -sf /etc/nginx/sites-available/bengolspices.com.conf     /etc/nginx/sites-enabled/bengolspices.com.conf
ln -sf /etc/nginx/sites-available/api.bengolspices.com.conf /etc/nginx/sites-enabled/api.bengolspices.com.conf

nginx -t
systemctl reload nginx
ok "site configs installed and nginx reloaded"

# ---------------------------------------------------------------------
say "Firewall"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH   >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  # 8000 stays closed to the internet, nginx reaches it over loopback
  ufw delete allow 8000 >/dev/null 2>&1 || true
  yes | ufw enable >/dev/null 2>&1 || true
  ok "ufw: ssh + http/https open, 8000 internal only"
fi

# ---------------------------------------------------------------------
say "certbot (HTTPS)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
fi
ok "certbot installed"

CERT_DOMAINS="-d bengolspices.com -d www.bengolspices.com -d api.bengolspices.com"

# The site configs written above listen on port 80 only. On a server that
# already holds certificates, overwriting those files strips out the 443
# blocks certbot had added and HTTPS goes down. Put them straight back.
if certbot certificates 2>/dev/null | grep -q "Certificate Name:"; then
  say "Re-applying the existing certificates to the new configs"
  # shellcheck disable=SC2086
  certbot --nginx $CERT_DOMAINS --non-interactive --agree-tos --redirect --keep-until-expiring 2>&1 | tail -5 \
    || warn "certbot could not patch the configs - run 'certbot --nginx' by hand"
  nginx -t && systemctl reload nginx
  ok "HTTPS restored"
else
  warn "no certificates on this server yet - issue them with:"
  echo "      certbot --nginx $CERT_DOMAINS --agree-tos --redirect -m YOUR_EMAIL"
fi
printf '\n\033[1;32mVPS prepared.\033[0m Next: run deploy/push.sh from the dev machine.\n\n'
