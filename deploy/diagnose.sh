#!/usr/bin/env bash
# =====================================================================
#  Read-only report on what the VPS currently looks like.
#  Changes nothing. Run on the VPS:  bash diagnose.sh
# =====================================================================

# Where the app actually lives (see DEPLOY.md). Override when calling if
# it is ever moved:  API_ROOT=/somewhere bash diagnose.sh
API_ROOT="${API_ROOT:-/var/www/Bengol-Spices-V2/BackEnd}"
WEB_ROOT="${WEB_ROOT:-/var/www/Bengol-Spices-V2/FrontEnd/dist}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bengol-spices}"

h() { printf '\n\033[1;36m--- %s ---\033[0m\n' "$*"; }

h "Machine"
hostnamectl 2>/dev/null | sed -n '1,6p'
echo "RAM:"; free -h | sed -n '1,2p'
echo "Disk:"; df -h / | sed -n '1,2p'
echo "Public IP: $(curl -s -m 5 ifconfig.me 2>/dev/null || echo unknown)"

h "Runtimes"
echo "node : $(node -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "npm  : $(npm -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "pm2  : $(pm2 -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "nginx: $(nginx -v 2>&1 | sed 's|nginx version: ||' || echo 'NOT INSTALLED')"

h "What is listening"
ss -ltnp 2>/dev/null | grep -E ':(80|443|8000|5000|3000)\b' || echo "nothing on the usual ports"

h "PM2 processes"
pm2 list 2>/dev/null || echo "pm2 not running anything"

h "Last 40 lines of API log"
pm2 logs bengol-api --lines 40 --nostream 2>/dev/null || \
  tail -n 40 /var/log/bengol-api/*.log 2>/dev/null || echo "no API logs yet"

h "nginx sites enabled"
ls -l /etc/nginx/sites-enabled/ 2>/dev/null
echo "config test:"; nginx -t 2>&1

h "nginx recent errors"
tail -n 25 /var/log/nginx/error.log 2>/dev/null || echo "none"

h "Web roots"
for d in "$WEB_ROOT" "$API_ROOT"; do
  if [ -d "$d" ]; then
    printf '%s  ->  %s, %s files\n' "$d" "$(du -sh "$d" 2>/dev/null | cut -f1)" "$(find "$d" -maxdepth 1 | wc -l)"
    ls -la "$d" | head -8
  else
    echo "$d  ->  missing"
  fi
  echo
done

h "API .env present?"
if [ -f "$API_ROOT/.env" ]; then
  echo "yes, keys only:"; sed 's/=.*/=<set>/' "$API_ROOT/.env"
else
  echo "NO .env - the API cannot reach MongoDB, Cloudinary or Razorpay without it"
fi

h "Does each service still accept its key? (database, uploads, payments, email)"
if [ -f "$API_ROOT/scripts/check-services.js" ]; then
  ( cd "$API_ROOT" && node scripts/check-services.js ) || true
else
  echo "  could not test (the API with scripts/check-services.js is not deployed yet)"
fi

h "API health"
curl -s -m 10 http://127.0.0.1:8000/health 2>/dev/null || echo "  no answer on 127.0.0.1:8000/health"
echo

h "Database backups"
if [ -d "$BACKUP_DIR" ]; then
  echo "kept: $(ls -1 "$BACKUP_DIR" | grep -cE '^[0-9]{4}-')   newest: $(ls -1 "$BACKUP_DIR" | grep -E '^[0-9]{4}-' | tail -n 1)"
  echo "nightly job: $(crontab -l 2>/dev/null | grep -c 'scripts/backup-db.js') line(s) in root's crontab"
else
  echo "none yet in $BACKUP_DIR"
fi

h "Local response check"
curl -s -o /dev/null -w "  127.0.0.1:8000        HTTP %{http_code}\n" -m 10 http://127.0.0.1:8000/products 2>/dev/null || echo "  127.0.0.1:8000        no answer"
curl -s -o /dev/null -w "  localhost:80          HTTP %{http_code}\n" -m 10 http://127.0.0.1/ 2>/dev/null || echo "  localhost:80          no answer"

h "Certificates"
certbot certificates 2>/dev/null | sed -n '1,30p' || echo "certbot not installed / no certificates"

printf '\n\033[1;32mReport finished.\033[0m\n\n'
