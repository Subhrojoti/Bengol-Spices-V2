# Store registration GPS collision fix — 27 October 2026

Status: **pushed, deployed and verified**, application commit `73c6f99`.
See [release evidence](../../deploy/releases/2026-10-27-store-gps-hotfix.md) for
backups, scope, source hashes, authenticated read-only smoke checks and rollback.

## Cause and evidence

The reported error comes from `createStore` in `controllers/store.controller.js`.
It queried any store with exactly equal latitude/longitude and rejected the new
registration, without considering its phone, agent or active/archive status.
The check incorrectly treated a position as a unique shop identity. Separate
shops can share a reported location; coordinate equality alone does not establish
a duplicate or prove that a reading was captured at the wrong store.

The exact screenshot error was reproduced against an isolated MongoDB using a
different agent, phone and shop at an existing store's coordinates. Before the
fix it returned 400 instead of 201. Read-only production inspection confirmed
that the deployed controller contains this check and that no unique GPS index
exists. No live request coordinates were available, so the specific device's
reason for returning identical coordinates was not established. No customer
location, phone, document URL or credentials were copied into these notes.

## Targeted change

Removed only the GPS-equality query/rejection. Distinct stores can now retain the
same actual captured coordinates. Existing requirements remain: authenticated
active agent, assigned state/pincode, valid nonzero/in-India GPS, complete address,
store type/photo and the existing trimmed-phone duplicate check. GPS is saved
unchanged, preserving delivery location checks and maps. The API shape, consumer
ID/delivery-code generation, target credit and upload cleanup are unchanged.

No schema/index/data migration or client update is needed. Agent/delivery/mobile
and frontend source files were not changed. This does not add a new guarantee
of GPS freshness, phone ownership or transactional phone uniqueness; the phone
check and its existing nonunique database index retain their previous behavior.

## Validation and rollout

All **43 backend tests passed** against isolated temporary MongoDB and mocked
external services. New regressions cover separate shops at active/archived
stores' exact coordinates across agents; unchanged saved GPS; duplicate phone,
invalid/non-India GPS and unauthorized pincode refusal; no consumed IDs on those
refusals; and failed-upload cleanup. The first new acceptance test was observed
failing with the exact production message before the controller change.

The backend was not started locally and no live store/order/payment data was
created, edited or deleted by verification. Initial production diagnostics were
read-only; post-deployment authentication checks created/revoked only their own
Admin sign-in session. The owner approved push/deploy after the 43 tests passed.

For release, use an isolated commit/archive excluding unrelated mobile and
Product Sales work. Back up the API/database, retain existing production settings,
and reload only `bengol-api` through the existing graceful PM2 deployment flow.
Verify deployed source/health and read-only authentication; do not register a fake
production store just to smoke-test this fix. Existing website/app binaries and
business records require no migration. After deployment the employee can retry
the form with a freshly captured location at the shop.
