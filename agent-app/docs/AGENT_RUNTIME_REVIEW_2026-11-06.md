# Agent runtime, performance and crash review — 6 November 2026

Status: **local changes only**; not committed, pushed or deployed. Production
remains the verified `73a7a61` application release. No backend, Admin, Delivery,
public web, native dependency, permission or production setting was changed.

## Scope and evidence boundary

Surveyed Agent routes and shared startup/session, query, list, form, image,
payment, return, target, notification, map and navigation code. Checked the
existing fixes before making changes. The owner's problem note also mentions
post-placement errors and returning to a completed cart; the existing successful
placement/navigation behavior was retained and exercised again.

No affected phone model, installed version or Play Console crash/ANR trace was
available. This identifies and fixes reproducible source issues; it does not
establish the cause of every reported customer crash or prove the app crash-free.

## Changes

1. **Hidden query work:** freezing tabs did not disable their query observers.
   Order/payment mutations could refetch hidden stores, histories and other
   screens. Heavy screen reads now follow navigation focus: order lists/detail,
   store lists/catalogues, overview/leaderboard, wallet, returns, product/cash/
   target history and order payment/modification history. Notification polling
   pauses when its observing screens are hidden. Invalidated data stays cached
   and refreshes when visible. Shared profile and the existing global target
   celebration summaries remain available; financial calculations are unchanged.
2. **Duplicate focus refresh:** removed redundant explicit focus refetch calls
   for reads now enabled by focus, including the store-correction parent read.
   This avoids cancelling/restarting the automatically initiated fresh read.
3. **Payments history download:** Due/Overdue fetch dues; Completed fetches the
   full history only when selected. Pull-to-refresh reads only that selected
   source. An unloaded Completed count is omitted rather than falsely shown as
   zero. Existing cached tab counts remain available. Existing layout and the
   previously virtualized order rows are retained.
4. **Read cancellation and retention:** query AbortSignals reach order, store,
   catalogue, overview/leaderboard, returns and order-history HTTP reads.
   Unobserved/cancelled queries can abort requests, including session cache
   clearing. Losing focus prevents new automatic work; an already-running read
   may finish. Mutations and payment verification are deliberately not aborted.
   Unobserved per-store history/catalogue caches expire after 60 seconds instead
   of the global five-minute retention. This does not remove server records.
5. **Store list rendering:** initial/batch rendering capped at five cards and a
   five-screen window, reducing the live native hierarchy while preserving all
   stores, search, filters, photos and actions. No pagination or record truncation.
6. **Images:** product previews unmount their image gallery while hidden and use
   current window dimensions. Product, header/profile and leaderboard images
   use bounded Cloudinary sizes. Camera previews and these photos request native
   decode resizing. Original uploads remain untouched. Signed/query, transformed,
   private and local image URLs are preserved rather than invalidated by URL edits.
   Profile also tolerates a missing documents object.
7. **Malformed response crashes:** overview/profile are validated before their
   fields enter render/chart code. Invalid summaries become retryable query
   errors, not invented zero-sales successes. Object unwrapping rejects primitive
   and array payloads. Null/primitive entity-list rows also become query errors
   instead of crashing renderers or being silently dropped from financial counts.
   Existing valid wrappers and legacy API formats remain supported.
8. **Map lifecycle:** hidden maps release their native WebView. Android renderer
   loss and iOS content-process termination expose manual Retry map; a lost
   renderer is replaced instead of repeatedly reloading a dead view. Selection,
   store details, navigation, attribution and provider rules are retained.
9. **Render recovery:** the root route exports a small, generic recovery view.
   It offers manual reopening, does not expose raw errors and never automatically
   resubmits an order/payment. It is a render-error boundary, not a native crash,
   ANR or arbitrary async-error handler.

## Verification

- `node --experimental-strip-types --test agent-app/tests/*.test.* delivery-app/tests/*.test.*`:
  **52/52 passed**. Covers the previous payment/return/edit/session checks plus
  real QueryObserver focus/invalidation behavior, cancellation forwarding,
  malformed financial/entity data, selected Payments reads, map renderer recovery,
  image lifecycle/sizing/signatures and manual screen recovery.
- Two focused lifecycle/cancellation regressions were also run against the prior
  source. Both failed for the intended reason (a hidden refetch and missing HTTP
  signal), then passed with the fix. Intentional baseline failures are separate
  from the passing final run.
- Agent `npm run typecheck`: passed.
- Final Android JavaScript/Hermes export: passed. This is not a signed AAB/APK.
- `git diff --check`: passed. No temporary profiling markers in application code.
- No backend runtime change in this pass, so the prior 113-test backend release
  verification is a baseline, not represented as a newly run backend suite.

## Android emulator checks

Used Pixel 6/Expo Go with the real backend code against disposable MongoDB,
fake accounts, 500 stores and 605 initial orders. External gateway, upload and
email services were disabled/mocked. No production API/account/payment was used.

- Home loaded real fixture totals. Payments > Due issued **one due-history read
  and zero all-orders-history reads**, plus its necessary shared store/photo read.
  The former implementation initiated both order histories. This verifies a
  removed download, not a claimed production frame rate or latency percentage.
- Searched 500 stores by consumer ID and opened the matching Create Order form.
  Product preview displayed minimum quantity 10 and remained usable.
- Placed one synthetic order for 300 with advance 0: PLACED, recorded 0, due 300,
  no new Payment (five existing fixture payments remained). The success screen
  opened; Back returned to Stores, not the completed cart. Neither hidden due nor
  all-orders history refetched after placement; visible order detail/target reads
  still ran. No gateway transaction occurred.
- Deliberately returned an incomplete overview response. The app showed its normal
  error/retry screen and kept navigation usable. Restored the response and tapped
  Try again: normal totals returned without an app restart.
- Opened the 500-store map, selected Fixture Store 1, inspected its details and
  navigated to the correct 602-order history. Product and map screenshots inspected.
- No native AndroidRuntime fatal exception found during these emulator checks;
  Metro showed the existing development-only reduced-motion warning, not a runtime
  app error. Renderer termination/retry is covered by deterministic component
  tests; an actual OS renderer kill was not forced.

Evidence: `output/agent-full-*`, with the final export under
`output/agent-runtime-review-final-android`. Disposable fixture helpers remain
under the existing ignored Admin audit folder. No source profiling code, live
credentials or real identity photographs were added.

## Release and remaining limits

A new Agent build/Play Store update is required; a VPS-only deployment cannot
deliver these mobile fixes. No new backend deployment or Delivery build is
required for this pass. Installed versions have not changed. The previously
deployed return/zero-advance APIs remain compatible.

Before rollout, smoke-test the signed release on a representative lower-memory
physical phone. Native camera/GPS permissions, live payment processing and the
specific customer crash/ANR need real-device/Play Console evidence; no camera,
GPS-validation, payment-accounting or target-credit rules were changed here.
