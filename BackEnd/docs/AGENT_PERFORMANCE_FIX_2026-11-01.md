# Agent collection Performance correction

1 November 2026. Local fix; not pushed/deployed. No financial records changed.

## Confirmed cause and limits

Direct read-only inspection of the VPS source (HEAD 6d9c509d5c3e66a755c6ae2daec2cc29ed358249)
found that getAgentCollectionPerformance still sums Order.paidAmount across all
orders and counts all Payment rows by Payment.agentId. The local/newer frontend
labelled that response as verified eligible collections. The API did not declare
its calculation basis, so recorded money could be represented as verified sales.
Cancelled orders also remained in the deployed calculation.

The earlier local endpoint partially corrected verification eligibility but
combined order-based agent rows with broader payment counts. The screen rounded
averages to whole rupees, did not show recorded/pending amounts and did not refresh
on the existing verification event. These source defects were reproduced/fixed.

No production financial record-level query or repair was executed. The screenshot's
exact Rs990 has NOT been independently reconciled against live payments; do not
claim that it is a verified figure or that a specific live balance was repaired.
A scripted remote inspection was rejected by automatic review; the successful
fallback was a direct grep of the existing deployed source, with no script sent.

## Calculation and compatibility

- agentCollectionReport.service.js is read-only. Start from non-cancelled orders,
  join their payment rows once, and attribute each to original Order.agentId.
  Missing-order payments cannot enter another agent's totals. Collector records,
  current store ownership, stored payments and targets/incentives are untouched.
- Preserve recordedAmount from authoritative Order.paidAmount. recordedTransactions
  counts the payment rows on those same orders; pending/rejected amounts are
  separate. Eligible amount and transaction count use the same qualifying rows.
- Reuse eligibilityOf for the established full/partial return exclusions. Office
  verification stays mandatory for new offline collections; legacy payments with
  no verification keep their established gateway/legacy eligibility treatment.
- Check each order's paid amount against its payment ledger. A mismatch is flagged,
  and its verified money is held out of this report until reviewed. No guessed
  correction, automatic approval, deletion, refund or payment migration occurs.
  Missing/future collection or counting dates are deferred rather than counted now.
- Stored Payment.agentId mismatches are reported, while this report credits the
  original order agent. Existing shared target/incentive services are not rewritten
  by this reporting fix. Actual inconsistent legacy records, if found, still need
  reviewed reconciliation; their underlying target attribution is not claimed fixed.
- Response keeps data[] and existing numeric field names, adding calculation
  VERIFIED_ELIGIBLE_V2, scope ALL_TIME_NON_CANCELLED_ORDERS, generatedAt and per-agent
  recorded/pending/rejected/return/date/reconciliation diagnostics. No new schema,
  index, permission or write API. Cache-Control is no-store.
- Frontend uses verified labels only for the explicit new calculation marker.
  An older/mixed deployment gets Reported collections/transactions and a visible
  message that verification/exclusions are not confirmed. It never guesses that
  an unmarked response is verified sales.
- The four cards, chart and table retain the existing layout. Recorded/pending
  details explain differences. Average per Agent divides by all returned agents
  with non-cancelled order history, including zeros; its denominator is explicit.
  Per-agent/per-transaction averages retain paise. All-zero data has no top agent.
- Existing cash-verification/order events and window focus refresh the read-only
  screen through its latest-request guard. No financial action runs from the chart.

## Verification

- Backend full suite: **83/83 passed**, including the final missing-date case.
- Browser: 25/25 affected Performance and existing section cases pass. Cases cover
  Rs990 across seven agents, Rs141.43 mean, Rs164.83 per transaction, recorded versus
  pending, phone/desktop overflow, old-response labels, verification refresh without
  writes, unreconciled warning and no invented top agent.
- Admin/component/test lint, SPA production build and **12/12 frontend unit tests
  pass**. No native files/web-agent/delivery-web edits.
- Ignored evidence: FrontEnd/.admin-audit.local/ecosystem-upgrade/ files
  agent-performance-backend.log, agent-performance-browser.log and
  agent-performance-build.log, agent-performance-lint.log and
  agent-performance-unit.log. Browser APIs and backend data are synthetic fixtures;
  the Rs990 test reproduces the screenshot arithmetic, not live account balances.

Both the report API and frontend need the update for verified financial results.
The deployed old API remains unchanged by this local work. Keep this reporting
fix distinct from the broader upgrade's pending native-device acceptance and
preserve all unrelated working-tree/staged changes during a later release.
