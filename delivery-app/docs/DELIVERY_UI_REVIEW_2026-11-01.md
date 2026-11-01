# Delivery Mobile App review — 1 November 2026

## Scope and status

Owner requested a Delivery App UI and functional bug review. Inspected the existing
Expo routes, shared controls, authentication, API clients, queries, delivery and
return transitions, collection recovery, maps, photos, history, notifications and
charts, together with the corresponding backend response shapes. Map, photo and
collection features already existed; this review improves those features.

Changes are **local only**. No commit, push, deployment, production account change
or production business write was performed. Existing ecosystem changes elsewhere
in the working tree were preserved. Delivery Web, Agent and Admin source were not
modified by this review; backend API behavior is unchanged.

## Findings and fixes

| Finding | Result |
| --- | --- |
| A blank collection amount fell back to the complete outstanding balance. | An explicit valid amount is required. A separately labelled full-balance button fills the field deliberately. Exact paise, outstanding limits and the existing UPI-reference requirement are checked before submission. Backend validation remains authoritative. |
| Order collections did not invalidate the partner's collection report. | Successful recording refreshes collections, assigned work, dashboard and history. An uncertain reply also refreshes payment history while retaining the original retry identifier. |
| A restored collection attempt did not restore its visible form fields. | Restore amount, method and reference with the same saved request ID. Route keys isolate different orders; the existing secure-storage and server-idempotency flow is retained. |
| Malformed or missing dates throw in date-fns. | History, notification and payment date helpers return “Date not recorded” instead of throwing. |
| An active-orders error prevented opening a completed order already available in History. | Resolve delivered history independently; retry both data sources when neither resolves the requested order. |
| Starting a map plan hid unplanned stores; only the first order at a store could be opened. | Keep planned and other destinations in one list, show every order at a selected store, prevent duplicate stops and prune inactive destinations. Safe reorder helpers reject missing/boundary IDs. |
| Map/list selection was not synchronized. | Use the existing local Leaflet engine with marker focus, popup synchronization and map retry. Active scope and coordinate validation remain explicit; invalid store locations can fall back to valid order coordinates. |
| Rapid status actions or late asynchronous completions could overlap or navigate away from a different screen. | Delivery/return action guards cover GPS, submission and status reconciliation. Screen state is keyed to the record; callbacks check that the screen remains mounted. Mutation automatic retry stays disabled. |
| A delayed 401 from an old login could expire the new session; token injection could overwrite an explicit logout token. | Match unauthorized responses against the currently stored token and preserve explicit authorization. Existing current-session expiry and unauthenticated login handling remain intact. |
| Store-photo modal close control had low contrast on its dark background. | Readable close action, photo caption, image-error/retry state, and HTTP(S) image URLs. |
| Delivery controls were buried below the payment form; long store names/notices were clipped. | Order identity, parcel details and delivery controls precede collections. Highlighted existing map action; longer names/addresses wrap, button labels shrink/wrap and icon buttons have accessible names. |
| Dashboard chart axes extended outside their cards. | Set each chart's x-axis length to its measured container width. The resumed phone pass confirmed both axes remain inside their cards. |
| Mounted tabs could show old results after navigation. | Refresh active stale queries when returning to the corresponding tab, retaining the existing 30-second cache lifetime and one-minute assigned-work polling. |
| Notification read failures were silent. | Show an error toast while retaining query invalidation on success. |

No new map provider, routing subscription or dependency was added. Manual stop
planning, OpenStreetMap attribution and external device navigation remain. This
review does not alter delivery-code verification, server GPS rules, assignment
ownership, Cash/UPI-only collection methods, office verification or sales credit.

## Validation

- `npm run typecheck`: passes across the Delivery App.
- `node --experimental-strip-types --test tests/delivery-view.test.mjs tests/session.test.cjs`:
  **8/8 pass**. Tests cover active map grouping and coordinate fallback, deduplication
  and safe stop reorder, explicit/exact collection amounts and UPI references,
  invalid dates, and the actual Axios interceptors with in-memory storage and an
  adapter (old-session 401, current-session expiry, explicit logout token and an
  unauthenticated wrong password).
- Android JavaScript export with dotenv disabled and the isolated fixture URL:
  passes. Output: `output/delivery-ui-review-2026-11-01`. It is a test bundle,
  **not a production release artifact**.
- `git diff --check -- delivery-app`: no whitespace errors.

### Connected Android phone

Used Expo Go with loopback fixture API `4198` and Metro `8085` through USB reverse.
The installed production application was not replaced. Fixture business data is
synthetic; the test server does not log tokens, request bodies or GPS coordinates.

Verified on the phone:

- Dashboard/list rendering, long store name and highlighted map action.
- Both active destinations visible, adding two planned stops, selecting a list
  store focuses its marker/popup, both order links at the same store available.
- Store-photo modal opens and exposes a readable Close photo control.
- Synthetic store-closed report succeeds and appears on the delivery.
- Incorrect handover code is rejected; valid fixture code completes the order,
  closes its detail screen and removes that order from the active map store card.
- Blank amount disables Record Collection; full-balance selection is explicit;
  a partial UPI amount remains disabled without a reference.
- Lost-response test: the API saved a synthetic ₹20 Cash receipt then dropped its
  response. The UI retained the saved request, displayed ₹20 recorded/pending and
  ₹180 outstanding. Retry used the same request and fixture payment count remained
  **one**. Explicitly collecting the remaining ₹180 produced two total receipts,
  zero outstanding and no collection form; all ₹200 remained pending verification.

### Resumed phone pass — same day

After the owner made the phone available again, verified:

- History lists the completed handover and renders the intentionally malformed
  legacy date as “Date not recorded”. A completed order remains readable while
  the isolated active-orders endpoint returns an error; the endpoint was restored
  afterwards.
- My Collections shows both synthetic receipts, ₹200 recorded, ₹0 verified and
  ₹200 pending verification, consistent with the earlier full-balance test.
- Return detail layout, required confirmation dialogs and transitions:
  `PICKUP_ASSIGNED → PICKED_UP → RECEIVED_AT_WAREHOUSE → COMPLETED`.
  Completion closes the detail screen and the active list shows no pickups;
  fixture state confirms zero active returns.
- Notifications render the malformed date without crashing; tapping the synthetic
  notification and navigating back works. The simple fixture returns an unread
  notification repeatedly, so badge-clearing persistence was not asserted.
- Profile renders the synthetic partner correctly, masks the identity number and
  opens Help & FAQ. The fixture supplies an empty FAQ list; the empty state and
  Back navigation work. An expanded FAQ was not tested in this fixture.
- Both final chart axes remain within their cards on the physical phone. The
  dashboard fixture has one monthly point and one yearly bar; large-text settings,
  landscape and the full production data distribution were not part of this pass.

No additional code fix was required during the resumed pass. The existing
typecheck, **8/8** regressions and final Android JS export remain applicable; only
review documentation changed afterwards. This is not a claim that every possible
native workflow passed. In particular, the fixture removes completed returns from
the active list but does not append them to return history, so a nonempty completed
return-history list was not exercised on this phone. iOS and a signed release
build have not been tested. Fixture idempotency verifies app retry behavior, not
the live backend's financial state. No live delivery or payment was used as a test.

Temporary screenshot/XML files were removed from the phone; the original
stay-awake setting was restored. Development previews remain separate from
production. The existing backend security/identity-file migration limitations in
the broader context notes remain outside this mobile-only review.
