# Admin-only security follow-up — 26 October 2026

Status: **pushed and deployed on 26 October 2026**, application commit `ea08a37`.
See [production release evidence](../../deploy/releases/2026-10-26-admin-audit.md).
The owner expanded the
frontend audit follow-up to backend and Admin frontend changes only, explicitly
excluding the agent and delivery web versions. No customer records, production
sessions or stored media were changed during local implementation/testing.
Live verification created and revoked only its own Admin sign-in sessions.

## Admin sessions

New Admin frontend logins opt into a server session with `X-Admin-Auth: cookie`.
The email/password JSON stays unchanged. The response is now, for this opt-in
flow only, `{ success: true, session: { role: "ADMIN", id, exp } }`; it contains no
bearer credential. Existing clients that omit the header still receive the
existing JWT response and their bearer requests remain supported.

`models/AdminSession.js` adds an independent `adminsessions` collection:

- Random 256-bit opaque token; only its SHA-256 hash is stored server-side.
- One-day expiry, checked on every authorized request, plus a TTL cleanup index.
- A keyed credential fingerprint invalidates sessions when configured Admin
  email/password or JWT secret changes. No password is stored in this collection.
- Logout deletes the matching session record and closes its open event streams.
  Revocation survives API restarts; it does not depend on process memory.

The browser holds the opaque credential only in a host-only HttpOnly cookie with
`Secure`, `SameSite=Strict`, and `Path=/` in production. Its production name is
`__Host-bengolAdmin`; local HTTP development uses `bengolAdminDev`. No Domain
attribute is set. Cookie login/session responses are `Cache-Control: no-store`.
Cookie-authenticated business responses and event streams also prohibit storage;
legacy bearer streams retain their existing cache headers.

The frontend stores only the public session ID, ADMIN role and expiry. Those are
navigation hints and cannot authorize a request. It verifies the cookie through
`GET /auth/admin/session` before treating login as successful, and sends cookies
with credentials plus `X-Admin-Session: <public id>` on API requests/event streams.
The server requires both the opaque cookie and a matching session ID. Bearer
headers retain precedence, so a failed agent/delivery bearer cannot fall through
to an unrelated Admin cookie.

CSRF protection uses the mandatory custom header and exact trusted Origin checks
on writes, including login/logout. Supplied origins are checked on reads too.
Requests without an Origin are accepted only for safe methods with the custom
header and valid cookie; a form/image request cannot supply that header. Existing
CORS settings are retained. Trusted origins come from the existing FRONTEND_URL
list, falling back to the live site names. Unconfigured development permits only
loopback origins, never arbitrary sites.

Frontend logout waits for server confirmation, shows progress, times out after
10 seconds and allows retry. A failed logout is not presented as a confirmed
revocation. An old request/logout cannot clear a newer session ID. Expiry and
cross-tab logout remove the Admin UI. Agent, delivery and employee token formats,
role checks and clients were not migrated.

Compatibility limits: already-open legacy Admin bearer sessions remain valid
under their existing rules until expiry/sign-out. A new frontend talking to an
older backend accepts its JWT response but keeps that fallback token in
tab-scoped sessionStorage rather than introducing a new persistent localStorage
credential. Existing legacy tokens are removed on a new successful Admin sign-in.
An HttpOnly cookie reduces credential theft via JavaScript; it does not prevent
same-origin XSS from issuing actions while a user is signed in.

## Additive endpoints

| Method / path | Requirement / result |
| --- | --- |
| POST `/auth/admin/login` with `X-Admin-Auth: cookie` | Existing credentials, trusted Origin; creates cookie session and returns public metadata |
| GET `/auth/admin/session` | Cookie plus matching X-Admin-Session; returns public metadata, no credential |
| POST `/auth/admin/logout` | Cookie, matching header and trusted Origin; deletes that session and expires cookie |

All business endpoints, request bodies, calculations and permissions retain their
existing behavior. `protect` and `optionalAuth` recognize this additional Admin
transport only when its explicit header is present. Live events revalidate the
same database session before publishing, retaining bearer behavior for everyone
else. No financial, stock, agent or delivery schema was changed.

## CSS dependency advisory

The frontend pins only the transitive `postcss-selector-parser` to 7.1.6 through
npm overrides, retaining Tailwind 3.4.19 and all application libraries. Version 7
changes insertion-during-iteration semantics, so this was verified against actual
application output rather than assumed compatible. The complete minified CSS is
byte-identical to the previous build: 97,226 bytes, SHA-256
`3f16f43a0aa36c9113b3b3476867156f2e0a935c074850efc05ddd2e8886c785`.
A clean lockfile install succeeds. The frontend full dependency audit now reports
zero findings, removing all three entries in the affected parser chain.

## Retained issues and scope

- Existing public identity-document URLs are **not made private by this change**.
  Privatizing existing Cloudinary assets requires migrating their delivery type
  and references across registration, profiles, Admin review and cleanup. Doing
  it only for Admin would leave old public URLs exposed; changing shared assets
  without updating all consumers could break the explicitly excluded clients.
  No live file was moved, deleted or reclassified. This remains a separate media
  migration with a reference inventory, backup, serializer compatibility and
  rollback validation.
- The 13 lint errors/2 warnings in Employee/profile/access-sync/agent-web code
  remain outside the owner's clarified scope. They were not suppressed or edited.
- Full-collection endpoints and the existing shared >500 kB entry chunk remain;
  changing reporting contracts or shared portal architecture is not part of this
  security follow-up. Earlier performance measurements remain a snapshot of the
  prior frontend audit, not a new timing claim for cookie authentication.

## Release and rollback

1. Deploy the backend first, then the matching frontend. Old bearer clients keep
   working during the transition. Do not include unrelated mobile edits.
2. Verify the `adminsessions` unique tokenHash and TTL expiresAt indexes. The new
   collection starts empty; there is no business-data migration.
3. Confirm production HTTPS, trusted Origin list, credentialed CORS, cookie flags
   and the normal same-site frontend/API domain relationship. SameSite=Strict is
   intentional; a genuinely cross-site host setup needs a separate reviewed
   configuration, not an automatic weakening of the cookie.
4. Have Admin sign out/in once, then check reload, multiple tabs, a read, an
   approved synthetic workflow and logout/replay on staging before production.
   Do not mutate real payments/orders merely to smoke-test deployment.
5. If rolling back to a frontend without the new logout flow, invalidate the new
   AdminSession records as part of rollback so an old UI cannot leave a cookie
   session alive behind a legacy local-only logout. Keep backups/rollback assets.
   This concerns only the new Admin session collection, not customer data.

Browser regressions intercept external APIs. Backend tests use an isolated
temporary MongoDB and real local HTTP cookie/header requests; no dotenv/server.js
or live credentials are loaded. They prove source-level compatibility and the
tested behaviors, not real production host/proxy configuration. Final executed
results are recorded in the frontend audit follow-up and validation file.

Executed checks: all 41 backend tests passed, including five new cookie-session
tests; nine frontend unit tests passed; all 64 browser cases passed separately in
Chrome and Edge; four focused React StrictMode cases passed. Admin lint and the
complete production build/prerender pass. Both full dependency audits and the
frontend production dependency audit report zero known vulnerabilities. The
offline source map resolves 446 imports across 121 backend modules and records
143 method/path entries. None of these checks changed production data.

References: [OWASP CSRF custom headers and Origin checks](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[MDN cookie attributes/prefixes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
[parser 7 changelog](https://github.com/postcss/postcss-selector-parser/blob/v7.0.0/CHANGELOG.md),
[parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
