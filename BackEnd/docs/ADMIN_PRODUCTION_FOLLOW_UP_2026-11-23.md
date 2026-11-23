# Admin and Employee Panel follow-up, 23 November 2026

The local review covered Admin and permitted Employee navigation, Orders, Bills,
Delivery Partner, Returns, stores, the catalog, targets, Product Sales,
Payment Info, Cash Verification, notifications and employee administration.
Browser checks used synthetic data. Backend checks used isolated MongoDB.

## Changes

- Employee requests carry the session they started with. A delayed response or
  permission check cannot clear a replacement Employee session or another
  panel's sign-in. Permission changes are still enforced on every API request.
- Employee sign-out revokes that bearer token on the API. Each new sign-in gets
  a unique token, and previously issued, unexpired tokens are accepted until
  they expire or are revoked. The browser can clear its local sign-in offline.
  Server revocation requires a successful logout request. An inactive
  employee's account status is disclosed only after password verification.
- In Store Details, changing the report query or using browser history keeps
  the list layout stable, disables prior rows and conceals any revealed codes
  while the new report loads.
- Store Dues returns to the last available page when a settlement empties the
  current page. A receipt response clears only the saved retry reference used
  for that submission. The office approval and sales attribution rules still
  apply.
- Employee sections load on demand through the existing office section
  boundary. Route permissions and design are preserved. The dev-only nodemon
  pin clears a minimatch finding. Both projects' full and production-only npm
  audits reported zero findings on 23 November.
  [Minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Measured performance

Three cold browser loads per build used Chrome headless, a 4× CPU slowdown,
60 ms simulated latency, 200,000 bytes/sec download and synthetic responses.
Encoded bytes are JavaScript loaded by the time the screen was ready.

| Screen | JavaScript before | JavaScript after | Median ready before | Median ready after |
| --- | ---: | ---: | ---: | ---: |
| Employee profile | 495,118 B | 248,588 B | 4.76 s | 3.20 s |
| Admin dashboard | 355,767 B | 355,249 B | 3.78 s | 3.87 s |

These timings come from the local fixture and do not measure production traffic.
The build still warns about a shared chunk exceeding 500 kB before compression.

## Verification

- Full local Chrome suite passed 180 tests across Admin and Employee workflows.
- The final build passed all 18 focused browser checks for Employee sign-out,
  permission changes, Store Details and Store Dues.
- All 134 backend tests and 18 frontend unit tests passed. Admin and updated
  Employee code passed lint. The SPA built successfully.

## Rollout

The Employee frontend and API changes are local. Deploy the API with or before
the frontend so the browser's logout request can revoke the token. The review
used isolated accounts, orders, receipts and permission grants.

Existing public identity-document URLs still need a storage migration.
[Identity-document review](ADMIN_SESSION_HARDENING.md).
