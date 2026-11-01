# Admin release recheck

1 November 2026. Local source/build review with synthetic intercepted browser
APIs; no production data access, account changes, deployment or publishing.
Unrelated working-tree changes are preserved.

## Finding and fix

Delivery Partner > Performance > Collection history lost its navigation after a
failed paginated read and offered no retry. Closing/reopening reset the page,
making a later page difficult to recover after a transient outage.

`PartnerCollections.jsx` now offers **Retry history**, preserving the partner,
page and selected report dates/basis. Each new attempt clears the old error and
stale history; existing abort/latest-request guards still reject obsolete reads.
The loading message has status semantics. Successful history, financial totals,
permissions, API requests and existing visual styling are unchanged.

`admin-release-review.spec.mjs` reproduces a page-2 HTTP 503 and verifies retry
recovers that same page/date basis without displaying page-1 records or issuing
any mutation. Before the fix it failed because Retry history did not exist.

## Review scope

Reviewed the Admin section inventory, existing audit notes, report request
lifecycle, delivery mapping/history, store-change review, product editing and
shared permission guards. The broad browser suite exercises all fourteen main
Admin sections and critical workflows: authentication, employee restrictions,
orders/invoices, payments, targets, products, store reports/corrections/deletion,
delivery assignment/history and responsive layouts. Browser API interception
checks UI behavior; backend authorization is covered separately by backend
tests, not inferred from frontend visibility.

## Validation

- Initial broad browser run: 144/145 passed in 7.3 minutes. One employee
  restriction test timed out after five seconds with the page still showing a
  progress indicator; no unauthorized content was shown. The same test then
  passed three isolated repeats without changing application/test code, and
  passed again in the final-build run. The timeout was not reproducible in
  those checks; its precise cause was not established.
- New recovery regression failed on the original build because Retry history
  was absent. After the fix, both 390px light and 1440px dark cases pass,
  including same-page/date-basis preservation and no mutation requests.
- Final affected-flow run: 18/18 passed on the rebuilt SPA, covering recovery,
  report pagination, delivery items/history, employee permissions and invoice
  downloads/errors. The entire broad suite was not rerun after this isolated
  collection-history change.
- Frontend units: 13/13 passed. Full Admin lint passed before the change; changed
  component/test lint and scoped whitespace checks passed after the change.
- Final SPA production build passed with its existing large-chunk warning.
- Retry screenshots inspected at both widths/themes:
  `.admin-audit.local/collection-history-error-{390,1440}.png`.
- Backend source was unchanged in this follow-up. The preceding leaderboard
  change's full backend run passed 91/91; it was not rerun here.

Prior dependency/storage limitations in the existing Admin audit remain separate
from this focused functional review; this is not a live penetration test.
