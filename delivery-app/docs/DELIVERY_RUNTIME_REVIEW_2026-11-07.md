# Delivery mobile runtime and registration review — 7 November 2026

## Scope and release state

The owner requested the same follow-up review as Agent, and chose “Whatever is
best” when asked whether to include registration dropdowns and runtime issues.
Inspected all Delivery mobile routes, read/mutation hooks, response consumers,
maps/photos, collections/QR recovery, item returns and registration. Existing
features were retained. Changes are local only: no push, VPS deployment, signed
app build, production credentials or production business writes.

Delivery Web and backend behavior are unchanged. Existing local Agent/backend
work elsewhere in the tree is independent and remains preserved.

## Findings and resulting behavior

- Mounted hidden Delivery/Pickup tabs polled every minute and refetched on
  unrelated mutations. Dashboard/history/notification/FAQ reads also remained
  enabled. Reads are now screen-focus aware; visible assigned work still polls
  every minute. Order/rules observers still share one query. Profile remains
  shared for visible headers and recovery identity. Manual mutation retry rules
  and foreground freshness remain unchanged. Query cancellation reaches Axios
  for reads; it never cancels a financial mutation. Blurring alone may allow an
  already-started read to finish.
- Active delivery detail unnecessarily downloaded the entire completed history.
  Load history only after active work resolves without that order (including an
  active-work error). Cached completed orders remain readable. Pull refresh now
  refreshes the source actually displaying the order. History's Collections
  segment disables its unrelated delivery-history observer. Unobserved history
  and collection cache lifetime is one minute; mounted caches remain retained.
- Delivery/Pickup sorting runs only when their data changes. List initial/batch
  rendering is bounded at six rows with a five-viewport window. Financial totals
  and server list contents are not filtered or truncated by this change.
- Malformed successful responses could crash charts/lists or show misleading
  balances. Read adapters reject invalid summary numbers, list structures,
  required order fields and collection totals into existing error/retry states.
  Individual rows are never silently discarded and missing balances are never
  invented. Missing optional identity-document metadata no longer crashes Profile.
- Maps release their WebView when covered. Android renderer loss / iOS content
  termination exposes Retry map and remounts the renderer, retaining destinations
  and native navigation/details. This is render recovery, not a claim to catch
  every native crash. Root render failures now offer manual reopening, generic
  wording and advice to check delivery/payment/return history first.
- Photos use bounded Cloudinary variants and native resize decoding. Signed,
  transformed, query-bearing, private and non-Cloudinary URLs stay intact. Large
  modal images are created only while the photo is open; current dimensions are
  read on layout changes.
- Delivery item-return retry references previously lived only in memory.
  Persist actor/order-scoped input before sending, restore exact selected items
  and reference after reopening, and fail closed on storage corruption/failure.
  Retain references on uncertain responses and clear only after success or a
  definitive validation/permission failure. Backend idempotency and office
  review remain authoritative; no automatic financial or stock adjustment.
- A lost QR-create response could locally unblock another collection before
  reconciling the pending QR. Re-read recovery before unblocking; resume the same
  server QR. Hidden/background QR screens do not poll; a visible foreground QR
  retains three-second checks. Late image-size callbacks cannot resize a newer
  QR. Existing Cash/UPI verification and payment history remain unchanged.
- Delivery registration has no store-creation workflow or Agent territory
  assignment. Its address State field now offers searchable offline suggestions
  with custom entry preserved. No city/pincode is guessed or auto-overwritten;
  these stay editable. Names follow the existing application's state names,
  checked against [Government of India Table 3.3](https://cdnbbsr.s3waas.gov.in/s316026d60ff9b54410b3435b403afd226/uploads/2026/01/20260128475572001.pdf).
  No third-party address API, subscription or dependency was introduced. The
  registration request format and office approval process are unchanged.

## Verification

- Complete Delivery offline suite: **24/24 pass** (`node
  --experimental-strip-types --test tests/*.test.mjs tests/*.test.cjs`). Uses
  actual hooks, React Query observers, real Axios interceptors and deterministic
  TSX component effects/callbacks with mocked native/payment/storage bridges.
  Covers focus invalidation/refocus, shared query deduplication, signal forwarding,
  malformed responses, map/photo recovery, offline/custom State selection,
  durable return replay, rapid collection taps/reopening and lost QR creation.
  Existing URL, amount, map scope, date and session regressions also pass.
- `npm run typecheck`: pass.
- Android JS/Hermes export: pass, `output/delivery-runtime-android`, using the
  production HTTPS API setting and dotenv disabled. This is an unsigned export,
  not an AAB or a Play Store release.
- `git diff --check -- delivery-app`: pass.
- Real React Query observer comparison against committed HEAD with identical
  synthetic cached data: ten hidden order invalidations caused **10 HTTP-function
  calls before, zero after**, then **one** refresh after focus returned. Output
  `output/delivery-runtime-query-measurement.json`. These are request counts,
  not native frame-rate or production-latency measurements.

### Emulator observations

Pixel 6 / Expo Go against a loopback-only synthetic API (103 active orders,
501 delivered history entries, one assigned pickup and one completed return).
No real gateway, production API or production registration was used.

- Dashboard, long delivery names, active detail and parcel quantities rendered.
- Opening active detail made **zero history requests** before History was visited.
- Map displayed **102 destinations**; selecting the shared store exposed links
  to both of its deliveries, and marker/list selection stayed synchronized.
- Typed and recorded a synthetic ₹25.50 Cash receipt once: recorded/pending
  ₹25.50, verified ₹0, outstanding ₹174.50. Existing office-verification wording
  remained visible. Lost-response/reopening behavior is additionally covered by
  deterministic component tests, not a live gateway experiment.
- 501-row History rendered; malformed legacy dates showed “Date not recorded”.
- Registration's State modal filtered to West Bengal, kept its controls above
  the native keyboard and filled the form after selection. City/pincode stayed
  editable and empty; no application or ID document was submitted.
- No AndroidRuntime/ReactNativeJS error was logged for the preview process during
  this pass. This does not substitute for customer crash/ANR diagnostics.
- Native layout screenshots/counters are under `output/delivery-runtime-*`.

The development-only reduced-motion warning was dismissed during inspection.
Customer crash/ANR traces and affected device/version details were unavailable;
this review cannot identify every reported native crash. iOS, physical-device
GPS, release-build memory/frame profiling and real payment-provider handover
remain outside this emulator/offline pass. Keep a signed-build smoke check before
Play Store rollout.

## Rollout

These Delivery changes need a new Delivery app build. They require no new
backend route, migration or employee permission. Any independently pending
Agent coverage endpoint must still be deployed before that Agent update. Keep
production credentials and QA fixtures/output out of commits and EAS archives.
