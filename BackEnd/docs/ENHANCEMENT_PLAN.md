# Production enhancements - implementation record

Request received 25 October 2026, from the attached production enhancement brief.
Work is local; deploying or altering live records is not part of this change.

## Decisions before implementation

1. Bundle the verified website Bengol logo with the backend and load it relative
   to import.meta.url. The current generator depends on a remote URL and silently
   omits failed images; BackEnd/public/logo.png is an unrelated logo. Keep the
   invoice geometry and calculations, add the requested heading and retain the
   Tax Invoice description. Do not bulk regenerate existing PDFs.
2. Keep Agent.status as approval lifecycle. Add a separate accessStatus and
   sessionVersion for immediate blocking/deactivation and safe reactivation.
   Agent deletion is a retained soft deletion, never a financial-record cascade.
3. Preserve Store.registeredBy and all historical transaction agentIds. Add
   Store.currentAgentId (missing means registeredBy) for current management.
   Apply that authorization to stores, orders, dues, invoice and return APIs.
   New collections on old orders retain the original sales attribution and
   record the actual collecting agent in Payment.collectedBy.
4. Admin-only transfer/deletion uses server previews, expiring confirmation,
   idempotent request IDs, transactions and audit records. Transfers change
   assignment only. Archived stores retain historical operations and financials.
   Option A archives; B also removes only safely disposable photo references;
   C physically removes only a store with no business dependencies. No historical
   order/payment/invoice/return/delivery/target/incentive/audit deletion option.
   Archive/delete must not interrupt open deliveries, returns or unpaid orders.
5. Reapplication reuses a rejected identity under existing unique indexes,
   archives the previous application snapshot and clears credentials. Approved,
   pending or administratively disabled identities cannot self-reapply.
6. Add daily/weekly/monthly/all-time verified collections to the existing
   dashboard response. IST calendar dates, Monday week start. Preserve existing
   fields and reuse sales eligibility/verification rules. Show order value,
   pending/rejected verification separately; do not call order value revenue.

## Scope and verification

Affected modules: agent/admin/auth/store/order/return/invoice controllers,
Agent/Store models, shared payment/access services, dashboard reporting, existing
admin Agent/Dashboard components and a store management dialog within Agents.
Existing unrelated mobile and ProductSales edits must be preserved.

Tests must use synthetic data and an isolated database, never BackEnd/.env.
Required checks: authorization after transfer, historical attribution, blocked
sessions after reactivation, atomic/idempotent transfer/delete, concurrent
reapplication, reporting reconciliation, invoice PDF image/text/layout, frontend
build and touched-file lint/static imports. Remaining live checks and migration/
rollback instructions will be recorded here before completion.

Implementation status: implemented locally. Verification, rollout, rollback and
remaining live/manual checks are recorded in
[PRODUCTION_ENHANCEMENTS.md](PRODUCTION_ENHANCEMENTS.md). Nothing has been deployed.
