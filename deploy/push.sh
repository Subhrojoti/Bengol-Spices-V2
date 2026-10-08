#!/usr/bin/env bash
# =====================================================================
#  Bengol Spices - deploy to the Hostinger VPS
#
#  Run from the project root on the dev machine (Git Bash):
#
#      bash deploy/push.sh              # everything: API, website, server rules
#      bash deploy/push.sh frontend     # only the website
#      bash deploy/push.sh backend      # only the API
#      bash deploy/push.sh nginx        # only the web server rules
#      bash deploy/push.sh check        # change nothing, report what is live
#      bash deploy/push.sh keys         # change nothing, test the keys in deploy/backend.env
#      bash deploy/push.sh backup       # take a database backup right now
#
#  Connection details come from deploy/deploy.env (not committed).
#
#  Every step that changes the server can undo itself:
#
#    website   uploaded beside the live copy and swapped in whole
#    API       the running version is saved first; if the new one does
#              not pass its health check, the saved one is put back
#    nginx     the live files are saved first; if the new ones fail
#              nginx's own test, or the site stops answering afterwards,
#              the saved ones are put back
#
#  The React build runs HERE, not on the VPS. It needs more memory than a
#  small VPS plan has, and on the server it is killed halfway through -
#  which is the usual cause of a deploy that "just errors".
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f deploy/deploy.env ] || { echo "Missing deploy/deploy.env - copy deploy/deploy.env.example and fill it in."; exit 1; }
# shellcheck disable=SC1091
source deploy/deploy.env

: "${VPS_HOST:?set VPS_HOST in deploy/deploy.env}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
WEB_ROOT="${WEB_ROOT:-/var/www/bengolspices}"
API_ROOT="${API_ROOT:-/var/www/bengol-api}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bengol-spices}"

SITE_HOST="www.bengolspices.com"
API_HOST="api.bengolspices.com"

SSH="ssh -p ${VPS_PORT} -o StrictHostKeyChecking=accept-new ${VPS_USER}@${VPS_HOST}"

TARGET="${1:-all}"
WARNINGS=()

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[0;32mok\033[0m  %s\n' "$*"; }
warn() { printf '    \033[0;33m!!\033[0m  %s\n' "$*"; WARNINGS+=("$*"); }

# ---------------------------------------------------------------------
#  Website
# ---------------------------------------------------------------------
build_frontend() {
  say "Building the website locally"
  ( cd FrontEnd && npm run build )
  [ -f FrontEnd/dist/index.html ] || { echo "Build produced no dist/index.html"; exit 1; }

  # Catch the classic mistake: a dev API address baked into the bundle
  if grep -rqs "localhost:8000" FrontEnd/dist/assets/*.js; then
    echo "Refusing to deploy: the bundle still points at localhost:8000."
    echo "Check FrontEnd/.env.production - it must hold the live API address."
    exit 1
  fi
  ok "built $(du -sh FrontEnd/dist | cut -f1), API address looks right"

  # The build ends by writing each public page out as real HTML for search
  # engines (FrontEnd/scripts/prerender.mjs). That step never fails the
  # build, so check here whether it actually happened.
  if [ -f FrontEnd/dist/app.html ] && [ -f FrontEnd/dist/about.html ]; then
    ok "public pages pre-rendered for search engines"
  else
    warn "Pages were NOT pre-rendered (see PRE-RENDER SKIPPED above). The site will work, but search engines and link previews will see an empty page."
  fi
}

upload_frontend() {
  say "Uploading the website"
  # Into a staging directory first, then swap. The live site is never
  # served from a half-finished upload.
  $SSH "rm -rf ${WEB_ROOT}.new && mkdir -p ${WEB_ROOT}.new"
  tar czf - -C FrontEnd/dist . | $SSH "tar xzf - -C ${WEB_ROOT}.new"

  $SSH "WEB_ROOT='${WEB_ROOT}' bash -s" <<'REMOTE'
set -e
NEW="${WEB_ROOT}.new"
LIST="${WEB_ROOT}.build-assets"      # beside the web root, never served

# The script and style files of THIS build, noted before anything is added
ls "$NEW/assets" > "$NEW.build-assets" 2>/dev/null || true

# Somebody with the site open keeps running the previous build until they
# reload. The panels load each screen's script the first time it is
# opened, by a file name that belongs to that build. If the file is gone
# the screen cannot open. So the previous build's scripts and styles stay
# for one more deploy. Only one build back: the one before that goes.
carried=0
if [ -d "${WEB_ROOT}/assets" ]; then
  if [ -f "$LIST" ]; then previous=$(cat "$LIST"); else previous=$(ls "${WEB_ROOT}/assets"); fi
  for f in $previous; do
    case "$f" in *.js|*.css) ;; *) continue ;; esac
    if [ -f "${WEB_ROOT}/assets/$f" ] && [ ! -e "$NEW/assets/$f" ]; then
      cp -p "${WEB_ROOT}/assets/$f" "$NEW/assets/$f"
      carried=$((carried + 1))
    fi
  done
fi

rm -rf "${WEB_ROOT}.old"
if [ -d "${WEB_ROOT}" ]; then mv "${WEB_ROOT}" "${WEB_ROOT}.old"; fi
mv "$NEW" "${WEB_ROOT}"
mv "$NEW.build-assets" "$LIST"
chown -R www-data:www-data "${WEB_ROOT}"
find "${WEB_ROOT}" -type d -exec chmod 755 {} +
find "${WEB_ROOT}" -type f -exec chmod 644 {} +
rm -rf "${WEB_ROOT}.old"
echo "    kept $carried script/style files of the previous build for open tabs"
REMOTE
  ok "website live from ${WEB_ROOT}"

  # Pre-rendered pages are picked by address. That needs the server rules
  # from deploy/nginx; under the old rules the site still works (each page
  # checks its own address) but search engines get the home page for every
  # address.
  if [ "$TARGET" = "frontend" ] && [ -f FrontEnd/dist/app.html ]; then
    if ! $SSH "grep -qs 'uri.html' /etc/nginx/sites-enabled/bengolspices.com.conf"; then
      warn "The web server is still on the old page rules. Run: bash deploy/push.sh nginx"
    fi
  fi
}

# ---------------------------------------------------------------------
#  API
# ---------------------------------------------------------------------
api_healthy() {
  # up to a minute: the process has to start and reach the database
  $SSH 'for i in $(seq 1 30); do
          code=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://127.0.0.1:8000/health || true)
          [ "$code" = "200" ] && exit 0
          sleep 2
        done
        exit 1'
}

# Before anything is uploaded: are the keys in deploy/backend.env still the
# ones each service accepts?
#
# A password or key changed in BackEnd/.env and not copied to
# deploy/backend.env is invisible until the deploy restarts the API with
# it. The running API holds its database connections open, so the site
# carries on working with a password that stopped being valid days ago,
# and goes down the moment it restarts. This asks each service first.
preflight_settings() {
  [ -f deploy/backend.env ] || {
    echo "Missing deploy/backend.env - the API cannot start without it."
    echo "Copy BackEnd/.env to deploy/backend.env and change FRONTEND_URL to the live domains."
    exit 1
  }

  say "Checking the keys in deploy/backend.env"

  if [ ! -d BackEnd/node_modules ]; then
    echo "    skipped here (run 'npm install' in BackEnd to enable it); the server checks the database before restarting"
    return 0
  fi

  local code=0
  ( cd BackEnd && node scripts/check-services.js --env ../deploy/backend.env ) || code=$?

  case "$code" in
    0) ok "every service accepts its key" ;;
    2)
      echo
      echo "Refusing to deploy: a key in deploy/backend.env is no longer accepted (marked REFUSED above)."
      echo "Uploading it would take that part of the live site down. If it was changed recently,"
      echo "BackEnd/.env probably holds the new one: copy that line into deploy/backend.env"
      echo "(keep FRONTEND_URL, NODE_ENV and JWT_SECRET as they are there) and run this again."
      exit 1
      ;;
    *) warn "A service could not be reached from this machine to check its key (see above). The server checks the database itself before restarting." ;;
  esac
}

deploy_backend() {
  say "Saving the API as it is running now"
  # So a version that does not start can be put back. The newest five are
  # kept. Root-only: the copy includes the server's .env.
  SNAPSHOT="$($SSH "API_ROOT='${API_ROOT}' bash -s" <<'REMOTE'
set -e
mkdir -p /root/bengol-backups && chmod 700 /root/bengol-backups
if [ -f "$API_ROOT/server.js" ]; then
  file="/root/bengol-backups/api-$(date +%Y%m%d-%H%M%S).tgz"
  tar czf "$file" -C "$API_ROOT" --exclude=node_modules --exclude='*.log' .
  chmod 600 "$file"
  ls -1t /root/bengol-backups/api-*.tgz | tail -n +6 | xargs -r rm -f
  echo "$file"
fi
REMOTE
)"
  if [ -n "$SNAPSHOT" ]; then ok "saved as $SNAPSHOT"; else ok "nothing running yet, first install"; fi

  say "Uploading the API"
  $SSH "mkdir -p ${API_ROOT} /var/log/bengol-api"

  # Source only. node_modules is installed on the server so native builds
  # match the server's own architecture and libc.
  tar czf - -C BackEnd \
      --exclude=node_modules \
      --exclude=.env \
      --exclude='*.log' \
      . | $SSH "tar xzf - -C ${API_ROOT}"

  # .env travels separately and never gets committed anywhere
  scp -q -P "${VPS_PORT}" deploy/backend.env "${VPS_USER}@${VPS_HOST}:${API_ROOT}/.env"
  $SSH "chmod 600 ${API_ROOT}/.env"
  scp -q -P "${VPS_PORT}" deploy/ecosystem.config.cjs "${VPS_USER}@${VPS_HOST}:${API_ROOT}/ecosystem.config.cjs"
  ok "source, .env and PM2 config uploaded"

  say "Installing dependencies on the VPS"
  $SSH "cd ${API_ROOT} && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund)"
  ok "dependencies installed"

  # The API is still running the previous version, untouched. It is only
  # restarted once the new settings are proven to reach the database from
  # this server. If they do not, the files are put back and nothing is
  # restarted, so a wrong password costs a failed deploy and not an outage.
  say "Checking the new settings reach the database from the server"
  if $SSH "cd ${API_ROOT} && node scripts/check-services.js --only database"; then
    ok "database reachable with the new settings"
  else
    echo
    if [ -n "$SNAPSHOT" ]; then
      $SSH "tar xzf ${SNAPSHOT} -C ${API_ROOT}"
      echo "The database could not be reached with the new settings, so the API was NOT restarted."
      echo "The previous files and .env are back in place; the site is running as it was."
    else
      echo "The database could not be reached with these settings, so the API was not started."
    fi
    echo "REFUSED means the MONGO_URI in deploy/backend.env is wrong. 'could not be reached' usually"
    echo "means the server's address is not on the MongoDB Atlas Network Access list."
    exit 1
  fi

  # The other services do not stop a deploy, but a refused key is said plainly
  $SSH "cd ${API_ROOT} && node scripts/check-services.js --only cloudinary,razorpay,resend" \
    || warn "A service refused or could not check its key from the server (see above). That feature will not work until its key in deploy/backend.env is corrected."

  say "Backing up the database before the new version starts"
  if $SSH "mkdir -p ${BACKUP_DIR} && chmod 700 ${BACKUP_DIR} && cd ${API_ROOT} && node scripts/backup-db.js --out ${BACKUP_DIR} --keep 14"; then
    ok "database backed up to ${BACKUP_DIR}"
  else
    warn "The database backup FAILED (see above). The deploy continued; run 'bash deploy/push.sh backup' and find out why."
  fi

  say "Restarting the API"
  $SSH "cd ${API_ROOT} && (pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs) && pm2 save"

  if api_healthy; then
    ok "API restarted and healthy (database connected)"
  else
    echo
    echo "    The new API did not become healthy within a minute. Its last log lines:"
    $SSH "pm2 logs bengol-api --lines 40 --nostream 2>/dev/null | tail -n 45" || true

    if [ -n "$SNAPSHOT" ]; then
      say "Putting the previous API version back"
      $SSH "cd ${API_ROOT} && tar xzf ${SNAPSHOT} -C ${API_ROOT} && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) && pm2 reload ecosystem.config.cjs --update-env && pm2 save"
      echo
      echo "The previous version is running again. Nothing else was changed."
      echo "The usual causes: a missing value in deploy/backend.env, or the VPS address"
      echo "not being on the MongoDB Atlas Network Access list."
    fi
    exit 1
  fi

  housekeeping
}

# Log rotation and the nightly database backup. Safe to repeat: each run
# writes the same two things again.
housekeeping() {
  say "Log rotation and nightly backup"
  $SSH "API_ROOT='${API_ROOT}' BACKUP_DIR='${BACKUP_DIR}' bash -s" <<'REMOTE'
set -e

# PM2 keeps the log files open, so they are copied and emptied in place
# rather than renamed. Without this they grow until the disk is full.
cat > /etc/logrotate.d/bengol-api <<'EOF'
/var/log/bengol-api/*.log {
    weekly
    rotate 8
    maxsize 50M
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# Every night at 20:30 server time (02:00 in India when the server clock
# is UTC). Any earlier copy of this line is replaced, never duplicated.
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
NODE="$(command -v node)"
LINE="30 20 * * * cd $API_ROOT && $NODE scripts/backup-db.js --out $BACKUP_DIR --keep 14 >> /var/log/bengol-api/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'scripts/backup-db.js' || true; echo "$LINE" ) | crontab -
echo "    logs rotate weekly (8 kept); database backed up nightly to $BACKUP_DIR (14 kept)"
REMOTE
  ok "in place"
}

backup_now() {
  say "Backing up the database"
  $SSH "mkdir -p ${BACKUP_DIR} && chmod 700 ${BACKUP_DIR} && cd ${API_ROOT} && node scripts/backup-db.js --out ${BACKUP_DIR} --keep 14 && ls -1 ${BACKUP_DIR} | tail -n 5"
}

# ---------------------------------------------------------------------
#  Web server rules
# ---------------------------------------------------------------------
deploy_nginx() {
  say "Updating the web server rules"
  local tmp="/tmp/bengol-nginx-$$"

  $SSH "rm -rf ${tmp} && mkdir -p ${tmp}" || return 1
  scp -q -P "${VPS_PORT}" deploy/nginx/bengolspices.com.conf deploy/nginx/api.bengolspices.com.conf \
      "${VPS_USER}@${VPS_HOST}:${tmp}/" || return 1

  $SSH "TMP_DIR='${tmp}' SITE_HOST='${SITE_HOST}' API_HOST='${API_HOST}' bash -s" <<'REMOTE'
set -u
FILES="bengolspices.com.conf api.bengolspices.com.conf"
# Overridable only so this block can be rehearsed against a scratch folder
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/bengol-backups}"
BACKUP="$BACKUP_ROOT/nginx-$(date +%Y%m%d-%H%M%S)"

# Where nginx actually reads each file from on this server
live_path() {
  local enabled="$NGINX_DIR/sites-enabled/$1"
  if [ -L "$enabled" ]; then readlink -f "$enabled"
  elif [ -f "$enabled" ]; then echo "$enabled"
  else echo "$NGINX_DIR/sites-available/$1"
  fi
}

# Status code for an address, asked of this machine directly
status() {
  curl -sk -o /dev/null -m 15 -w '%{http_code}' --resolve "$1:443:127.0.0.1" "https://$1$2" 2>/dev/null || echo 000
}

changed=""
for name in $FILES; do
  cmp -s "$TMP_DIR/$name" "$(live_path "$name")" || changed="$changed $name"
done
if [ -z "$changed" ]; then
  echo "    already up to date"
  rm -rf "$TMP_DIR"
  exit 0
fi

site_before=$(status "$SITE_HOST" /)
login_before=$(status "$SITE_HOST" /admin/login)
api_before=$(status "$API_HOST" /products/public/allProduct)

mkdir -p "$BACKUP" && chmod 700 "$BACKUP_ROOT"
for name in $changed; do
  dest="$(live_path "$name")"
  echo "$dest" > "$BACKUP/$name.path"
  if [ -f "$dest" ]; then cp -p "$dest" "$BACKUP/$name"; fi
  install -m 644 "$TMP_DIR/$name" "$dest"
  [ -e "$NGINX_DIR/sites-enabled/$name" ] || ln -s "$dest" "$NGINX_DIR/sites-enabled/$name"
done
rm -rf "$TMP_DIR"

put_back() {
  for name in $changed; do
    dest="$(cat "$BACKUP/$name.path")"
    if [ -f "$BACKUP/$name" ]; then
      cp -p "$BACKUP/$name" "$dest"
    else
      rm -f "$dest" "$NGINX_DIR/sites-enabled/$name"
    fi
  done
}

if ! nginx -t > "$BACKUP/nginx-test.txt" 2>&1; then
  echo "    nginx refused the new rules:"
  sed 's/^/      /' "$BACKUP/nginx-test.txt"
  put_back
  echo "    The previous rules are back in place; nginx was never reloaded."
  exit 3
fi

systemctl reload nginx
sleep 2

site_after=$(status "$SITE_HOST" /)
login_after=$(status "$SITE_HOST" /admin/login)
api_after=$(status "$API_HOST" /products/public/allProduct)
echo "    home page   $site_before -> $site_after"
echo "    admin login $login_before -> $login_after"
echo "    API         $api_before -> $api_after"

broken=""
[ "$site_before" = "200" ] && [ "$site_after" != "200" ] && broken="the home page"
[ "$login_before" = "200" ] && [ "$login_after" != "200" ] && broken="the admin login"
[ "$api_before" != "$api_after" ] && broken="the API"

if [ -n "$broken" ]; then
  put_back
  nginx -t > /dev/null 2>&1 && systemctl reload nginx
  echo "    $broken stopped answering as before, so the previous rules were put back."
  exit 4
fi

echo "    previous files kept in $BACKUP"
REMOTE
  local result=$?

  if [ "$result" -eq 0 ]; then
    ok "web server rules in place"
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------
#  What is live right now. Changes nothing.
# ---------------------------------------------------------------------
verify() {
  say "Checking what is live"
  sleep 2
  $SSH "pm2 list | sed -n '1,12p'" || true
  echo
  $SSH "SITE_HOST='${SITE_HOST}' API_HOST='${API_HOST}' BACKUP_DIR='${BACKUP_DIR}' bash -s" <<'REMOTE'
line() { printf '    %-44s %s\n' "$1" "$2"; }
status() { curl -sk -o /dev/null -m 15 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

echo "  API"
line "health (database connected)" "$(curl -s -m 10 http://127.0.0.1:8000/health 2>/dev/null || echo 'no answer')"
line "https://$API_HOST/health" "HTTP $(status https://$API_HOST/health)"
line "products list" "HTTP $(status https://$API_HOST/products/public/allProduct)"
# Each open admin or employee tab keeps one connection to the API for live
# order notices. Over HTTP/1.1 a browser allows six to one site, so several
# panel tabs would use them all up and the panel would stop loading.
# HTTP/2 (set in deploy/nginx) carries everything over one connection.
proto=$(curl -sk -o /dev/null -m 15 -w '%{http_version}' "https://$API_HOST/health" 2>/dev/null || echo "?")
if [ "$proto" = "2" ]; then
  line "connection type" "HTTP/2"
else
  line "connection type" "HTTP/$proto   <-- not HTTP/2: several panel tabs in one browser will stall. Run: bash deploy/push.sh nginx"
fi

echo "  Website"
line "/" "HTTP $(status https://$SITE_HOST/)"
line "/about" "HTTP $(status https://$SITE_HOST/about)  $(curl -sk -m 15 https://$SITE_HOST/about | grep -o '<title>[^<]*</title>' | head -1)"
line "/admin/login" "HTTP $(status https://$SITE_HOST/admin/login)"
line "/an-address-that-does-not-exist" "HTTP $(status https://$SITE_HOST/an-address-that-does-not-exist)  (404 expected)"
line "/home" "HTTP $(status https://$SITE_HOST/home)  (301 expected)"
line "/robots.txt" "HTTP $(status https://$SITE_HOST/robots.txt)"
line "/sitemap.xml" "HTTP $(status https://$SITE_HOST/sitemap.xml)"

echo "  Backups"
if [ -d "$BACKUP_DIR" ]; then
  line "newest database backup" "$(ls -1 "$BACKUP_DIR" 2>/dev/null | grep -E '^[0-9]{4}-' | tail -n 1 || echo none)"
  line "kept" "$(ls -1 "$BACKUP_DIR" 2>/dev/null | grep -cE '^[0-9]{4}-')"
else
  line "database backups" "none yet"
fi
REMOTE
}

# ---------------------------------------------------------------------
case "$TARGET" in
  frontend) build_frontend; upload_frontend ;;
  backend)  preflight_settings; deploy_backend; verify ;;
  nginx)    deploy_nginx || { echo; echo "The web server rules were NOT changed. The site is as it was."; exit 1; }; verify ;;
  check|verify) verify ;;
  keys)     preflight_settings ;;
  backup)   backup_now ;;
  all)
    # Keys first, then the build: if a key is stale or the website does
    # not build, nothing on the server has been touched yet. Then the API
    # before the website, so a page never calls an API route that is not
    # there yet.
    preflight_settings
    build_frontend
    deploy_backend
    upload_frontend
    deploy_nginx || warn "The web server rules were NOT updated (details above). The site keeps working under the previous rules. Fix and run: bash deploy/push.sh nginx"
    verify
    ;;
  *) echo "Usage: bash deploy/push.sh [all|frontend|backend|nginx|check|keys|backup]"; exit 1 ;;
esac

if [ "${#WARNINGS[@]}" -gt 0 ]; then
  printf '\n\033[1;33mDone, with %s thing(s) to look at:\033[0m\n' "${#WARNINGS[@]}"
  for w in "${WARNINGS[@]}"; do printf '  - %s\n' "$w"; done
  echo
else
  printf '\n\033[1;32mDone.\033[0m\n\n'
fi
