# Admin bug review — 1 November 2026

Local review and fixes requested by the owner. No push, deployment, database
updates or production workflow actions were performed. Existing working-tree
changes and the staged mobile store-screen rename were preserved.

## Corrections

| Area | Finding | Correction |
| --- | --- | --- |
| Orders Agent/Store lookup | During the search debounce, Enter could choose an old highlighted result. The API also returns the selected option for label resolution, even when it does not match the new search. | Immediately invalidate the previous request, clear choices and block selection while loading. Filter displayed options against the current query while retaining the selected label. |
| Delivery sections | Clicking a tab changed component state but left the URL unchanged. Reload and browser history restored the wrong section. | Derive the active permitted tab from the URL and update its `tab` parameter on navigation, preserving other parameters. Alert-to-dispatch reassignment still works. |
| Agent > Store Details | An in-flight delivery-code reveal could survive report filter changes, leave the reveal control busy, or display a late response. | Give reveals a separate cancellable request lifecycle, invalidate them on filter/refresh/unmount, clear busy state and ignore superseded responses. |
| Due-date extension | Cancel/dismiss retained the date and reason; reopening could submit an abandoned draft. | Clear both fields when closing. Closing remains disabled during submission. |
| Payment Info | Cancelled orders' retained `dueAmount` values were included in active outstanding/overdue totals and filters, and could appear as pending debt. | Use zero active outstanding for cancelled orders in statistics, store totals, filters, rows and CSV Due/Overdue fields. Show Cancelled rather than Settled/Pending. Keep recorded payment and order history. |
| Payment Info compatibility | Older/incomplete API responses without verification totals displayed missing verified/pending amounts as zero. | Show Not available and explain incomplete totals. Per-order breakdowns likewise distinguish missing data from a genuine zero. |

## Scope and contracts

Affected source: `OrderFilterLookup.jsx`, `Delivery.jsx`, `StoreDetails.jsx`,
`DueDateExtension.jsx`, `PaymentInfo.jsx`, and the `revealStoreDeliveryCode`
wrapper in `src/api/services.js`. That wrapper now accepts optional Axios request
options for cancellation; callers that omit options keep the same request body
and endpoint. No backend implementation or authorization policy changed during
this review. The payment summary controller was read to verify that cancellation
status, saved due dates and retained financial values are available separately.

These changes retain the current layout, permission checks and mutation
payloads. No agent/mobile/delivery-web code was edited for this audit. They do
not repair historical accounting data or change payment verification, targets,
incentives, invoice issuance or credit rules.

## Validation

Six browser regressions were added in `tests/browser/admin-edge-audit.spec.mjs`.
They exercise quick keyboard search (including a nonmatching selected API
option), tab reload/back/forward, a held late delivery-code response, cancelled
extension drafts, cancellation-only debt exclusion, and an older response with
missing verification totals. All six pass on the final SPA build. The first four
issues were reproduced against the previous implementation; the Payment Info
issues were confirmed by source review and the final synthetic cases. Early
Payment Info test attempts used a nonexistent URL; those failures are not evidence
of the financial bugs. The corrected route is `/admin/payment-summary`.

Admin lint and the shared extension component lint pass; frontend unit tests
pass 12/12 and the SPA build passes. The full Admin/Employee browser suite passes
121/121 (3.1 minutes), including all six new cases, order actions/invoices,
payments/verification, targets/incentives, reports, session handling, employee
permissions, store cleanup and responsive layouts. `git diff --check` passes.
Build retains the existing large-chunk warning.

Evidence is ignored local output under
`FrontEnd/.admin-audit.local/admin-bug-review-2026-11-01/`, including initial
source snapshots, before/final regression logs and final lint/unit/build logs.
Node's unit runner needed child-process permission after sandbox `spawn EPERM`;
the normal `npm test` command subsequently passed.

Browser checks use intercepted synthetic API responses and a loopback static
server. They cover frontend behavior and request contracts, not real financial
balances, production authorization execution or physical-device acceptance.
The backend was not started locally. Live deployment remains a separate step.
