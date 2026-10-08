# Deploying Bengol Spices to the Hostinger VPS

## How it is laid out

| Piece   | Address                        | Where it lives                                    |
|---------|--------------------------------|---------------------------------------------------|
| Website | `https://www.bengolspices.com` | `/var/www/Bengol-Spices-V2/FrontEnd/dist`, served by nginx |
| API     | `https://api.bengolspices.com` | `/var/www/Bengol-Spices-V2/BackEnd`, PM2 on `127.0.0.1:8000` |

The VPS is `200.234.40.154`, Ubuntu with nginx 1.24. The domain uses Hostinger's
nameservers. Certificates come from Let's Encrypt, one covering the apex and
`www`, a second covering `api`, both renewed by certbot's own timer.

The mobile apps are not deployed here. They only need the API address above.
See [Building the mobile apps](#building-the-mobile-apps).

## Deploying

```bash
bash deploy/push.sh            # everything: API, website, web server rules
```

That one command is the normal way. The others exist for when only one part
changed, or to look without touching anything:

| Command | What it does |
|---|---|
| `bash deploy/push.sh` | API, then website, then web server rules, then a report |
| `bash deploy/push.sh backend` | The API only |
| `bash deploy/push.sh frontend` | The website only |
| `bash deploy/push.sh nginx` | The web server rules only |
| `bash deploy/push.sh check` | Changes nothing. Reports what is live: API health, pages, backups |
| `bash deploy/push.sh keys` | Changes nothing. Tests every key in `deploy/backend.env` |
| `bash deploy/push.sh backup` | Takes a database backup right now |

Connection details live in `deploy/deploy.env`, authentication in
`~/.ssh/config` under the host `bengol-vps`. Neither is committed.

### What a full deploy does, in order

1. **Tests the keys** in `deploy/backend.env` against the database, Cloudinary,
   Razorpay and Resend. A key any of them refuses stops the deploy before
   anything has been uploaded.
2. **Builds the website** on this machine. The build needs more memory than the
   VPS has. It ends by writing each public page out as real HTML for search
   engines (see below).
3. **API**: saves a copy of what is running, uploads the new source and `.env`,
   installs dependencies, checks the database can be reached *from the server*
   with the new settings, backs the database up, and only then restarts.
4. **Website**: uploaded beside the live copy and swapped in whole, so the site
   is never served from a half-finished upload.
5. **Web server rules**: installs `deploy/nginx/*.conf` if they changed.
6. **Reports** what is live.

### Every step can undo itself

| Step | If it goes wrong |
|---|---|
| Keys | Nothing has been touched. Fix the key and run again. |
| API settings cannot reach the database | The previous files and `.env` are put back and the API is **not restarted**. The site carries on as it was. |
| New API does not pass its health check | The saved copy is restored and restarted. |
| nginx refuses the new rules | The previous files are put back. nginx was never reloaded. |
| Site stops answering after the new rules | The previous files are put back and nginx reloaded. |

The last five copies of the API are kept in `/root/bengol-backups/api-*.tgz`, and
every replaced nginx file in `/root/bengol-backups/nginx-<date>/`.

### Keys: the one thing to remember

`deploy/backend.env` is what the live server runs on. It is uploaded as the
server's `.env` on every API deploy. `BackEnd/.env` is only this machine's copy.

**When you change a password or key, change it in both files.** In October 2026
the database password and the Cloudinary and Resend keys were changed in
`BackEnd/.env` alone. The live site kept working, because a running API holds
its database connections open, and would have gone down at its next restart.
The deploy now tests the keys first for exactly this reason.

Three lines differ between the two files on purpose and must stay as they are
in `deploy/backend.env`: `FRONTEND_URL` (the live domains), `NODE_ENV=production`
and `JWT_SECRET` (changing it signs everybody out).

Both files currently hold **live** Razorpay keys. A payment tested on this
machine takes real money. Put Razorpay *test* keys in `BackEnd/.env` for
development.

## Building the mobile apps

The agent app (`agent-app/`) and the delivery app (`delivery-app/`) are built
separately, after the API is live:

```bash
cd agent-app      # or delivery-app
eas build -p android --profile preview      # an APK to install directly
```

**Which API a build talks to.** While developing, an app uses the address in
its own `.env` (usually this computer's Wi-Fi address, so a phone can reach
the backend running here). An installed build must not: that address only
works on one network, and Android refuses plain `http` in a release build.
So an installed build uses `https://api.bengolspices.com` unless `.env` holds
another `https` address (`src/api/baseUrl.ts`), and `eas.json` sets the live
address for the `preview` and `production` profiles. Nothing has to be edited
before building.

**Deploy the API first.** These builds depend on the current API:

- the delivery app sends the store's 6-digit delivery code when marking an
  order delivered, which only the current API asks for;
- changing a password signs out the agent's other devices and gives the app
  a fresh session, which only the current API returns.

A build made today against the old live API would run, but those two things
would not behave as described.

**Changing a product to Packet.** The agent app keeps the catalogue for up to
ten minutes. The server records every order with the product's current unit
and price whatever the app still shows, so nothing is recorded wrongly in
between.

## Invoice files

Invoice PDFs are kept in Cloudinary, which serves a file to anyone who has
its address. They used to be stored under the invoice number
(`…/invoices/BS-26-27-1.pdf`), so every invoice could be fetched by counting
upwards. Each file's name now ends in a code that cannot be guessed.

The first time the new API starts on the server, it moves the invoices that
are still under their old names, one at a time in the background, starting a
minute after the database connects. Look for these two lines in the log (the
number is however many invoices there are):

```
Invoice files: moving 42 to unguessable names in the background
Invoice files: 42 of 42 moved
```

Any that could not be moved (Cloudinary did not answer) are tried again on
the next restart, and an invoice is also moved the first time somebody
downloads it. Nothing needs doing by hand. Downloads go through the API as
before and are unaffected.

## Search engines

The site is a single-page app: without help, the HTML a search engine or a
WhatsApp link preview receives is an empty box. So the build
(`FrontEnd/scripts/prerender.mjs`) writes each public page out as real HTML with
its own title, description, share image and structured data:

| Address | File | |
|---|---|---|
| `/` | `index.html` | home, full content |
| `/about`, `/careers`, `/help`, `/terms`, `/privacy` | `about.html` … | full content |
| `/agent-onboarding`, `/delivery-partner-register` | their own `.html` | right title and share tags; the form is drawn in the browser |
| `/admin`, logins, panels | `app.html` | empty shell, marked "do not index" |
| anything else | `404.html` | answered with a real 404 |

`sitemap.xml` is rewritten on every build with that day's date. `robots.txt`
keeps search engines out of the panels.

All page titles, descriptions and company details live in one file,
`FrontEnd/src/seo/site.js`. Change them there.

If the pre-render step fails, the build still succeeds and says so in a box
headed `PRE-RENDER SKIPPED`; the deploy repeats the warning. The site works,
but search engines see the empty shell until it is fixed.

**After the first deploy**, add the site in Google Search Console and submit
`https://www.bengolspices.com/sitemap.xml`. That is the one step that cannot be
done from here.

## Is it up?

```bash
curl https://api.bengolspices.com/health
```

`{"status":"ok","database":"connected",…}` with HTTP 200 means the API can do its
job. HTTP 503 means the process is running but cannot reach the database, which
PM2 alone would show as "online". Point an uptime monitor (UptimeRobot, Better
Stack, any of them) at that address.

### Live order notices and HTTP/2

An open admin or employee panel keeps one connection to the API so a new order
shows up, with a chime, the moment it is placed. Over the older HTTP/1.1 a
browser allows only six connections to one site, so five or six panel tabs in
one browser would use them all and the panel would stop loading. The web server
rules in `deploy/nginx` switch the API to HTTP/2, which has no such limit.
`bash deploy/push.sh check` prints the connection type; it should say HTTP/2.

The notices rely on the API running as **one** process (PM2 "fork" mode, one
instance, as `deploy/ecosystem.config.cjs` sets it). Do not switch it to
cluster mode: an order handled by one process would never reach a panel
connected to another.

## Backups

The database is backed up **every night at 02:00 India time** to
`/var/backups/bengol-spices/` on the VPS, and once more before every API deploy.
Fourteen are kept. Each is a dated folder with one compressed file per
collection.

```bash
bash deploy/push.sh backup        # take one now
bash deploy/push.sh check         # shows the newest backup and how many are kept
```

The database itself is on MongoDB Atlas, not on the VPS, so these backups are
already on a different machine from the data. For protection against losing the
VPS as well, copy the folder off it now and then:

```bash
scp -r bengol-vps:/var/backups/bengol-spices ./bengol-backups
```

### Restoring

Always into a **new, empty database first**, to look at it:

```bash
ssh bengol-vps
cd /var/www/Bengol-Spices-V2/BackEnd
node scripts/restore-db.js /var/backups/bengol-spices/2026-10-07_2030 \
     --to "mongodb+srv://USER:PASSWORD@CLUSTER/bengol-restore-check"
```

The restore script never reads the API's own database address, so it cannot
overwrite the live data by accident. It refuses to touch a collection that
already has records unless `--replace` is given.

## Logs

`pm2 logs bengol-api` shows them live. The files are in `/var/log/bengol-api/`
and are rotated weekly, eight kept, so they cannot fill the disk.

At startup the API lists any setting missing from `.env` and what will not work
without it. Look for `Missing from .env` in the first lines after a restart.

## Why deploys used to fail

The API was started by hand from an SSH session:

```
node /var/www/Bengol-Spices-V2/BackEnd/server.js
```

That process belonged to the login session's cgroup, so it did not survive a
reboot and nothing supervised it. Meanwhile PM2 already had its own copy of the
same app registered as `project-backend`, and PM2's copy could never bind port
8000 because the hand-started process was holding it. PM2 restarted it, it
failed, PM2 restarted it again. It had accumulated **240 restarts**.

So the site kept working, because the hand-started process served it, while
every attempt to update through PM2 silently failed. That is the whole mystery.

`npm` was also missing. Ubuntu's `nodejs` package does not include it, so there
was no way to install dependencies or build on the server at all.

Fixed by removing the duplicate PM2 entry, installing npm, and running the API
as a single PM2 app named `bengol-api` with `pm2-root.service` enabled, so it
now comes back after a reboot.

## What else was wrong

**Node was too old.** The server ran Node 18.19.1 while the installed Mongoose 9
declares `engines: { node: ">=20.19.0" }`. It happened to work, but it was
unsupported. Now on Node 22.

**The bare domain broke every API call.** `bengolspices.com` and
`www.bengolspices.com` both served the site with no redirect between them, and
`FRONTEND_URL` listed only the `www` origin. A visitor arriving without `www`
got a page that rendered and then loaded nothing, with no error on screen. Now
the apex returns a 301 to `www`, and `FRONTEND_URL` lists both.

**`/` rendered an empty page.** The router had a parent route at `/` drawing the
header, an `Outlet` and the footer, with children for `home`, `about`, `careers`,
`help`, `terms` and `privacy`. None was an index route, so `/` matched the parent
and had nothing to put in the outlet. Only `/home` worked. Checked against the
real route table:

```
                            before                     after
/                    depth=1  renders nothing    depth=2  renders Home
/home                depth=2  renders Home       depth=2  renders Home
/a-mistyped-address  depth=0  blank white page   depth=1  renders ErrorPage
```

A catch-all was added at the same time. nginx hands every unknown address to
`index.html`, the router matched none of them, and a mistyped link gave a plain
white page.

**The HTML shell was cacheable.** It was served with `Last-Modified` and an
`ETag` but no `Cache-Control` at all. With no instruction a browser decides for
itself how long the file stays fresh, and it decides generously. Visitors kept
loading a cached shell naming the previous build's scripts, so an address they
had opened before served the old site while a path they had never visited served
the new one. Every HTML page is now checked for a newer copy on each visit
(`no-cache` for the public pages, `no-store` for the panels); hashed files under
`/assets/` are cached for a year.

That asset rule also needed `^~`. As a plain prefix it lost to the image regex
below it, and every PNG in the build picked up the wrong rule.

**Proxying went through `localhost`.** That resolves to `::1` first on this box
while the app listens on IPv4, so every request paid for a failed IPv6 attempt.
The `connect() failed (111: Connection refused)` lines in the nginx log were all
that. Now `127.0.0.1`.

**Uploads over 1 MB were rejected by nginx**, before Express ever saw them. The
API now accepts 25 MB, and slow invoice and courier calls get 120 seconds rather
than the 60 second default.

**`JWT_SECRET` was 17 characters**, short enough that the app's own startup check
warned about it. It is now 64. Everyone signed in against the old secret has to
log in again.

**The Debian default site was still enabled** and answering on port 80.

## When something is wrong

```bash
scp deploy/diagnose.sh bengol-vps:/root/ && ssh bengol-vps "bash /root/diagnose.sh"
```

Read-only. Reports RAM and disk, listening ports, PM2 status, the last lines of
the API log, nginx config validity and recent errors, whether the API `.env`
exists, whether the server can reach MongoDB Atlas, and certificate state.

### Things that come up

**`EADDRINUSE :::8000`** — something outside PM2 is holding the port. Check with
`ss -ltnp | grep 8000` before killing anything; this is exactly what caused the
240 restarts.

**Never start the API by hand.** `pm2 restart bengol-api` is the only correct
way. A hand-started process takes the port and PM2 cannot recover on its own.

**`module is not defined in ES module scope`** — `BackEnd/package.json` sets
`"type": "module"`, so the PM2 config has to be `ecosystem.config.cjs`, not `.js`.

**PM2 says `online` but every request fails** — usually MongoDB Atlas. The app's
`connectDB` catches the failure and lets the server start anyway, so the process
looks healthy. Check the PM2 log for an error right after `Server running on
port 8000`, and confirm the VPS IP is on the Atlas allowlist.

**`rewrite or internal redirection cycle`** — `index.html` is missing from the
web root, so the SPA fallback loops. It means a build or upload did not finish.

## Useful commands

```bash
ssh bengol-vps                      # opens a root shell on the VPS
pm2 list                            # is the API up
pm2 logs bengol-api --lines 100     # what it said
pm2 restart bengol-api
nginx -t && systemctl reload nginx
tail -f /var/log/nginx/bengolspices-api.error.log
```

Config backups from this work are in `/root/bengol-backups/`, alongside the
original `.env`.

## Worth doing next

**Submit the sitemap** in Google Search Console (see "Search engines" above).

**An uptime monitor** on `https://api.bengolspices.com/health`, so an outage is a
message on your phone rather than a call from an agent.

**Razorpay test keys on the dev machine.** `BackEnd/.env` holds live keys.

**The database is named `test`.** The address in `.env` ends in `/?appName=…`,
and the code adds `/bengol-spices` after it, which MongoDB reads as part of the
option rather than as a database name. So every record lives in the default
database, `test`. It works and nothing depends on the name; it is noted here so
nobody "fixes" the address and finds an empty database. Moving it would mean
copying every collection across in a maintenance window.

Two stale copies of the app sit in `/var/www` from earlier deploy attempts,
`Bengol-Spices-V2.backup-20260917-1354` and `Bengol-Spices-V2.deleted-20260917`.
They are harmless and can go once you are confident in the current state.
