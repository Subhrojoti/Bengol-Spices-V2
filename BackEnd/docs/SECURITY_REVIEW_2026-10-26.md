# Backend security and reliability review — 26 October 2026

Scope: backend only, against application release `f4a5e09` and repository notes.
This records a source/dependency review and isolated regression checks, not a
claim that all possible vulnerabilities have been excluded. Production release
verification is recorded at the end when complete.

## Confirmed issues corrected

| Area | Before | After |
|---|---|---|
| Production dependencies | npm audit reported 4 high-severity package entries from 3 advisories | Cloudinary 2.11.0, Multer 2.5.0 and transitive body-parser 2.4.0; production and full backend audits report zero known vulnerabilities |
| Reset/setup links | Concurrent submissions could both read a valid token and save different passwords | Conditional atomic token consumption and password update; only one submission succeeds |
| Password changes | Backdated timestamps left recently issued sessions working briefly; pending reset links survived a password change | Version increments revoke old agent/partner sessions immediately, including same-second tokens; password changes invalidate outstanding reset links |
| Concurrent password changes | Read/hash/save could overwrite another change | Compare-and-set against the previous password and session version; stale changes return 409 |
| Login throttling | Concurrent requests could all pass before failed responses were counted | In-flight checks also count toward the existing per-account limit; closed requests release their reservation |
| Live events | Already-open employee streams retained old permissions until their periodic reconnect | Recheck the original JWT and current account/permissions before each event; fail closed on invalid sessions or authorization lookup failures |
| Authentication | A correctly signed token without a recognized login role passed the authentication middleware | Only supported login roles/valid account IDs accepted, including when other signed token types are submitted |
| Stock reservation | A database exception on a later product left earlier successful decrements behind | Compensate earlier confirmed reservations before propagating the error; ordinary insufficient-stock behavior stays unchanged |
| Upload cleanup | Early invalid store forms and missing-product edits leaked already-uploaded files; late product-edit errors could delete a committed replacement image | Capture uploaded IDs before validation, retain photos already owned by persisted records, and clean rejected uploads |
| Product errors | Some database/SDK exception details were returned directly | Existing public-error helper preserves form messages and removes internal exception details |
| Upload folders | Query text containing another route name could influence the folder | Determine folder from the route path alone |

The old `multer-storage-cloudinary` adapter requires Cloudinary 1.x, so upgrading
that SDK while retaining its peer constraint would require an unsupported install.
It was replaced by a small owned Multer storage adapter using the documented
`upload_stream` API. File fields (`path`, `filename`, `size`), folder conventions,
accepted formats and size/count limits remain compatible. It handles stream
errors/disconnects once and removes a late successful orphan upload.

Advisory references:

- [Cloudinary parameter injection](https://github.com/advisories/GHSA-g4mf-96x5-5m2c).
- [Compressed body-parser denial of service](https://github.com/advisories/GHSA-27r3-jxmh-p828).
- [Multer request teardown denial of service](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).
- [Cloudinary upload_stream API](https://cloudinary.com/documentation/node_image_and_video_upload#the_upload_stream_method).

## Compatibility and production precautions

No frontend/mobile source, business permissions, calculation rules, existing
password strength policy, JWT lifetime or credentials were changed. Existing
agent/partner sessions without a version are accepted as version zero until a
password/access change revokes them. DeliveryPartner gains an optional default-zero
sessionVersion; there is no bulk migration or new index. Password changes still
return a fresh working token. Setup/reset responses keep their existing shape.
No server.js startup or operational database mutation was used for local testing.

The event publisher now performs asynchronous authorization reads per connected
employee and business event. Admin checks only verify the token. Event queues
preserve ordering per connection; authorization errors close the connection so
the existing client reconnect behavior can recover.

## Verification

Local tests use temporary MongoDB replica sets and synthetic/mocked gateway data;
they never import dotenv/server.js or load a configured live database URI.
The suite covers existing store transfers, permanent test cleanup, authorization,
invoices, coverage, verified-sales calculations and gateway replay, plus new
reset races, legacy/new session compatibility, stream revocation, concurrent
login throttling, compressed parser errors, stock rollback, multipart metadata,
multi-file forms, upload cleanup and committed-image retention.

Clean `npm ci --ignore-scripts` succeeded without legacy-peer flags. npm audit
for both production-only and all backend dependencies reported zero findings.
A uniquely named synthetic one-pixel PNG was uploaded through the patched SDK
and owned storage adapter using configured Cloudinary credentials, then deleted
through the adapter and checked again for cleanup. No customer file or database
record was created/modified by that compatibility check.

All **36 backend tests passed**. Offline validation parsed 118 modules, resolved
435 relative imports/static exports and extracted 141 unchanged route entries.
Production deployment evidence is recorded after release.

## Review limits and retained architectural concerns

- Reviewed authentication/roles, routes and ownership, reset flows, upload and
  invoice delivery, stock/payment/gateway handling, management cleanup, return
  transitions, reporting and notification boundaries against the source map.
  No additional cross-account access bypass was confirmed in those checks.
- This does not replace a penetration test, infrastructure/configuration audit
  or proof against future dependency advisories. No hostile traffic was sent to
  production, and no real payment/refund/password reset or deletion was tested there.
- Identity-document assets still use unguessable public Cloudinary URLs. Anyone
  holding such a URL can fetch it. Private delivery requires a separately reviewed
  migration of existing assets and authenticated response URLs; this release does
  not silently move/delete those documents and break existing client references.
- Existing multi-document order/payment/incentive writes are not all transactional.
  This release fixes the reproduced stock-compensation gap, not every possible
  crash/uncertain-write recovery case. A transaction/reconciliation redesign needs
  separate fault-injection validation before replacing live financial workflows.
- Throttles and event connections remain in memory, matching the single API process.
  Multi-instance deployment would require shared rate-limit/session-event handling.
