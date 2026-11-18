# Admin security/bug review and release preparation — 18 November 2026

## Scope

Reviewed Admin/Employee navigation and backend authorization, employee creation,
session response handling, office receipt/approval/replay logic, report filters,
HTML rendering and current dependency advisories. Used the existing context and
read affected implementations; no production business mutations were used as
tests. All previously completed local work is preserved for the requested push.
This is a source/regression review, not certification that every production
attack or native-app defect is absent.

## Confirmed fixes

1. **Old employee responses could destroy a newer login.** The Admin response
   handler already matched the request's session, but Employee 401 handling did
   not. It now clears Employee credentials only when the response authorization
   still matches the current Employee token and panel. Actual Axios-adapter tests
   cover replacement login, switching panels and genuine current-session expiry.
   Agent/Delivery Web handling is unchanged.
2. **Employee creation allowed bcrypt-truncated password suffixes.** The old
   limit was 128 characters even though bcrypt only uses 72 UTF-8 bytes. New
   employee passwords longer than 72 bytes are rejected before creation, including
   multibyte input. Existing stored passwords and login behavior remain unchanged.
3. **Published Mongoose security fixes were missing from the lockfile.** Upgraded
   only 9.11.1 → pinned 9.11.4 on the same minor line, with the existing MongoDB
   driver retained. Upstream [release notes](https://github.com/Automattic/mongoose/releases/tag/9.11.4)
   fix connection-level sanitizeFilter, discriminator/prototype/inherited-property
   handling and mquery. See the [sanitizeFilter advisory](https://github.com/Automattic/mongoose/security/advisories/GHSA-gg4r-jv3p-qx3c)
   and [inherited-property advisory](https://github.com/Automattic/mongoose/security/advisories/GHSA-8332-j7wj-wjw4).
   No global sanitizeFilter option was newly enabled: legitimate internal
   aggregation/query operators retain their existing behavior.
4. **Unused build plugin was installed as a frontend runtime dependency.** Removed
   unused `@tailwindcss/vite`; the actual Vite configuration uses React and the
   existing PostCSS/Tailwind 3 configuration. Build, style and browser regressions
   validate that removal. Fixed the stray separator in receipt audit text too.

The new Store dues APIs retain backend `canVerifyPayments` checks, server-derived
collectors, transaction/order/store locks, immutable retry inputs, overpayment
checks and existing approval/target attribution. Product HTML is sanitized before
the only Admin `dangerouslySetInnerHTML` use. Employee administration remains
Admin-only; no permission default or existing grant was changed.

## Dependency results and remaining concerns

- `npm audit --omit=dev` reports **zero** for both backend and frontend after the
  changes. This is a registry snapshot, not a guarantee about all vulnerabilities.
- Full frontend audit still reports **11 high dependency entries**, all belonging
  to the same unpatched Picomatch dependency chain in Vite/Tailwind build tools.
  [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists no
  patched release as of this review. These tools run locally against repository
  patterns; they are not included in the deployed static website or API runtime.
  Do not expose the development server or evaluate untrusted glob patterns.
  Forced unrelated major downgrades/overrides were not used to conceal the audit.
- **Legacy public identity-document URLs remain a known storage concern.** This
  release does not revoke/migrate them. As recorded in
  [the earlier hardening review](ADMIN_SESSION_HARDENING.md), making existing
  Cloudinary documents private needs a coordinated storage/URL compatibility
  migration and verification for installed clients. Do not represent UI link
  checks or the current Admin audit as private storage. Existing production
  configuration and live files are preserved during this Admin release.

## Verification and release boundaries

- Full backend suite on patched Mongoose: **121/121 pass**, using disposable
  MongoDB/mocked services. Frontend units **16/16 pass**, including three new
  real-interceptor Employee-session cases. Admin lint and SPA build pass.
- Pending mobile source rechecked before pushing: Agent **45/45**, Delivery
  **24/24**, both typechecks pass. These are source checks, not signed mobile
  release tests. Mobile changes still require separately built app binaries.
- Full isolated Admin/Employee browser suite **176/176 pass**. The committed
  production build and live checks are recorded in the deployment release record
  after completion. The final audit-text separator is verified in that build.
- Read-only VPS preflight: Node 22.23.2, sufficient disk space, both API processes
  online. All prior **186 backend / 220 website files** match the last verified
  release hashes. No unexpected live-source edits were overwritten.
- Release staging uses exact committed source, current live backend settings,
  locked production dependencies, fresh code/site/database backups and atomic
  directory replacement with a graceful API reload. Prior assets are retained
  for already-open panels. HR process, nginx, credentials and employee grants
  must remain unchanged. Post-release checks are read-only except normal Admin
  verification login/logout; no real payment, order or permission is modified.

This document records preparation. The release record establishes whether push,
deployment and live verification actually completed.
