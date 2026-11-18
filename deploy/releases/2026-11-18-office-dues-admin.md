# Production release: office dues and Admin security fixes

Deployed and verified: **18 November 2026 (Asia/Calcutta)**.
Application commit: `1797cc3a4b41240656bdbc2a327882cf78efd32b`, pushed to main.

## Live scope

- **Cash Verification → Store dues** now provides store balances, outstanding
  orders, office receipt entry and separate approval. The existing verifier
  permission applies to Admin/authorized Employee operations, enforced by the API.
  Original sales-agent attribution and payment/verification history are retained.
- Fixed late Employee 401 responses signing out replacement sessions, and new
  employee creation accepting bcrypt-truncated passwords longer than 72 UTF-8
  bytes. Existing password hashes/login behavior remain supported.
- Backend Mongoose patched 9.11.1 → **9.11.4**, same minor line. Removed the unused
  frontend Tailwind/Vite plugin; current Tailwind 3/PostCSS design is retained.
- Added the previously reviewed Agent own-coverage read API. Agent/Delivery
  runtime/dropdown/recovery source changes are pushed, but **separate mobile builds
  are still required**; no AAB/APK/Play Store rollout was performed.

Details: [office workflow](../../BackEnd/docs/OFFICE_STORE_DUES_2026-11-18.md),
[security review and remaining concerns](../../BackEnd/docs/ADMIN_RELEASE_REVIEW_2026-11-18.md),
[Agent registration](../../BackEnd/docs/STORE_REGISTRATION_CHOICES_2026-11-06.md),
[Agent runtime review](../../agent-app/docs/AGENT_RUNTIME_REVIEW_2026-11-06.md),
[Delivery review](../../delivery-app/docs/DELIVERY_RUNTIME_REVIEW_2026-11-07.md).
Their local-only status statements describe earlier implementation stages; this
release record establishes the live backend/website state.

## Checks

- Backend **121/121**, full Admin/Employee browser **176/176**, frontend units
  **16/16**, Admin lint and build pass. The exact committed production candidate
  was separately built/prerendered and passed **21/21** affected-flow browser
  checks. No regression test used real production business mutations.
- Pending mobile source: Agent **45/45**, Delivery **24/24**, both typechecks pass.
  These do not replace signed-build/device validation for mobile rollout.
- Both production dependency audits report zero. The unpatched build-only
  Picomatch chain still appears in the full development audit, and legacy public
  identity-document storage still needs a coordinated privacy migration. Neither
  is represented as fixed by this release. See the security review above.
- Prior deployment matched all **186 backend / 220 website files** before staging.
  Current live settings were copied privately into the candidate; locked production
  installation, runtime imports and read-only database/storage/gateway/email
  credential checks succeeded before switching.
- After graceful reload/atomic switch, all **190 backend / 220 website files**
  match release hashes. Live Mongoose is **9.11.4**, HTTPS/API/database health and
  HTTP/2 pass. Production settings fingerprint is unchanged; no nginx, credentials,
  PM2 settings, employee grants, data backfill or index migration was changed.
- Stable API process: PID **232464**, restart count **1**. HR process remained PID
  **202516**, restart count **0**, online throughout the checked release interval.
- Public/About, Admin/Employee login, Agent Web and Delivery Web entry pages return
  200. Normal authenticated Admin sign-in and Store dues list/UI/order/payment
  history, All-stores scope, Orders/Bills, cash tabs, Returns, store reports/change
  requests, mappings, delivery reports and permission-editor reads passed.
- Live smoke blocked business mutations; no real receipt, approval, order,
  permission change or delivery-code reveal was submitted. Unauthenticated
  financial POST requests were refused. No page/API server errors were observed
  during smoke. The temporary verification login was revoked; replay was refused.

## Backups and recovery

- Private release root: `/root/bengol-release-office-dues-20261118`, containing
  restricted `api-before.tgz`, `website-before.tgz`, saved asset manifest and
  configuration fingerprint. Gzip integrity passed before switching.
- Database backup: `/var/backups/bengol-spices/2026-11-18_1401`, **1,657 documents
  across 30 collections**, all archives integrity-checked. Normal staff work may
  continue after that snapshot; never restore it over live business activity
  blindly.
- Previous API/dependencies:
  `/var/www/Bengol-Spices-V2/BackEnd.previous-office-dues-20261118`.
- Previous website:
  `/var/www/Bengol-Spices-V2/FrontEnd/dist.previous-office-dues-20261118`.
- Previous JS/CSS assets remain available for already-open panels. Refresh office
  pages to load the new release. Prefer a forward fix; before source rollback,
  assess office receipts written since deployment and retain their audit/balances.
  No database rollback or cleanup was performed by this release.

Private helpers/evidence remain under ignored
`FrontEnd/.admin-audit.local/release-office-dues-20261118/`; local regression logs
are under `output/admin-release-20261118-*`. No credentials are recorded here.
