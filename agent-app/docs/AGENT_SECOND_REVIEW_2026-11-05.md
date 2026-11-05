# Second Agent mobile review — 5 November 2026

Status: **local only**. No commit, push, deployment or production-data change.
This follows `AGENT_REVIEW_2026-11-05.md`; preserve its fixes and the earlier
pending item-return/zero-advance feature. This pass changes Agent mobile only,
plus continuation notes; backend, Admin and Delivery behavior are unchanged.

## Findings and changes

- **Payments expansion:** an expanded store previously rendered its entire
  order history through a nested `map`. Store headers and order rows now share
  the existing outer virtual FlatList, with stable keys and bounded rendering.
  Existing tabs, order sequence, totals, photographs and card styling remain.
  Payment partitions/grouping are memoized against their actual inputs rather
  than rebuilt on every expansion. Helpers live in `src/utils/paymentList.ts`.
  The emulator also revealed a disappearing expanded-state chevron; explicit
  up/down icons now replace the SVG rotation while preserving the icon design.
- **Deadline transitions:** Payments now checks time while focused and refreshes
  immediately on foregrounding. Its clock does not refetch orders, skips timer
  updates in the background and removes the timer/listener on blur. Classification
  uses the saved due date, including extensions; missing/invalid deadlines are
  retained in Due. Cancelled orders remain excluded from Completed.
- **Nested invoice button:** stops event propagation, so Download invoice does
  not also navigate to order details. Store toggles and invoice buttons have
  accessible labels; toggles expose expanded state.
- **QR confirmation timing:** the delayed confirmation now retains the callback
  of the QR that was paid. A newer QR cannot replace it. In-flight/done guards
  prevent overlapping confirmation retries, and hiding/reopening the same paid
  QR retains its confirmation/retry state. Payment receipt is still recorded if
  the modal is closed during its brief success delay, as before.
- **Expired QR and image race:** unpaid closed QRs stop polling and display a
  retry instruction. Successful polls clear transient errors. Image sizing resets
  for a new image and ignores a late result from the previous QR.
- **Initial-payment snapshot:** QR and online placement verification use the cart
  and advance captured when that payment session was created. Later form edits
  cannot silently change the paid session's order payload or displayed advance.
- **Checkout messages:** malformed or mismatched order references are ignored;
  duplicate success messages are handled once per checkout order. Server-side
  signature/payment validation remains authoritative and unchanged.

## Verification

- `npm run typecheck` in `agent-app`: passed.
- `node --experimental-strip-types --test agent-app/tests/*.test.* delivery-app/tests/*.test.*`:
  **41/41 passed**. This includes existing `.test.cjs` session/release checks as
  well as `.test.mjs` suites; earlier review counts covered `.test.mjs` only.
- Android JavaScript/Hermes export: passed, no native dependency added.
- `git diff --check`: passed.
- New component tests transpile the actual TSX source with deterministic mocked
  hooks, timers and payment APIs. They cover QR callback replacement, hide/reopen
  retries, expiry, stale image sizing, original cart/advance for QR and ONLINE,
  checkout replay/malformed messages and clock foreground/cleanup behavior.
- Four QR regressions were also run against the previous source and failed as
  expected, then passed against the fix. These intentional baseline failures
  are recorded separately from the passing final test run.
- Payment-list tests check saved deadline boundaries/extensions, malformed dates,
  cancellation and preservation of all 5,000 orders and stable row identities.

## Emulator measurement and UI checks

Used the installed Pixel 6 emulator/Expo Go, the actual pending backend against
disposable MongoDB, fake accounts and disabled external payment/file services.
The fixture had 605 due orders, with **601 under one store**. No production API,
customer account or real payment was used.

A temporary React Profiler on both implementations recorded:

| First store expansion | Previous nested list | Virtualized list |
| --- | ---: | ---: |
| Order-line renders in first expansion commit | 601 | 7 |
| Profiler render duration for that commit | 14,198.5 ms | 314.8 ms |

The optimized list subsequently rendered additional batches as its window filled
(38 cumulative order-line renders at initial settling). It did not mount the
entire 601-order history at expansion. These are **single development/emulator
samples**, affected by profiling, compilation and host load; they are not a
production latency, release-build speedup or frame-rate claim. The bounded row
rendering is the directly verified improvement. Profiling code was removed
before final typecheck, regression tests and Android export.

Native checks verified expansion, scrolling to later orders, opening PERF-0004
with its correct products/balance, returning to the same scroll position, and
tapping its invoice control without navigating away from Payments. Expanded
card alignment was inspected from screenshots. No invoice was shared externally.
The final uninstrumented bundle was also checked with a single-order expansion:
the up-arrow and rounded card footer both rendered correctly.
Synthetic logs/screenshots are under `output/agent-second-*`; local fixture
scripts and synthetic access records are under the existing Admin audit folder.

No live QR/card transaction, signed AAB or physical-device check was performed
in this pass. A signed-release smoke check remains appropriate before rollout.

## Rollout

A new Agent build is needed. There are no API format, schema, package or public
web changes in this pass. The **earlier pending item-return and zero-advance
backend changes must deploy before shipping the mobile build containing those
features**. See `BackEnd/docs/ITEM_RETURNS_ADVANCES_2026-11-05.md`. Do not treat
these local checks as confirmation of deployed state.
