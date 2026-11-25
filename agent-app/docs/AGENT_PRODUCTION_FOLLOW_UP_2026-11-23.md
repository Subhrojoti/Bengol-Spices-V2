# Agent App production follow-up

23 November 2026, Asia/Calcutta. This review builds on the prior Agent audit
and the Delivery payment/session work. It rechecked Agent authentication,
profile, store onboarding, maps, catalogue, checkout, collections, returns,
history, notifications and target screens. Changes are local.

## Checkout and payments

- Cash and zero-advance checkout saves the submitted cart and request ID in
  app-private device storage before posting. If a reply is lost, reopening
  checkout offers the same order with the original advance and request ID. It
  asks the agent to resolve that attempt before entering a new cart. A saved
  file contains the order payload and no Bearer token or gateway credentials.
  [Expo FileSystem documentation](https://docs.expo.dev/versions/v56.0.0/sdk/filesystem/)
- The server honours replay for the same order before examining current stock.
  For newly placed orders it binds the request ID to the original store, cart
  and advance. Reusing it for a different order is refused. Legacy orders can
  still be replayed for the original store. Order placement loads product IDs
  in one query and retains the existing name lookup for legacy requests.
- Agent due QR creation records the code and reuses it on a repeated request.
  Open a pending order's Collect Payment screen to resume the QR or safely
  close it unpaid. An unpaid QR releases only after the gateway confirms the
  code is closed with zero captured funds and no unsettled payment attempt.
  During recovery, a different collector's QR is reported as pending and its
  image and amount stay private. Offline receipts and new due QR issuance are
  blocked across Agent, Delivery and office paths while an issued due QR is
  unresolved. A previously recorded offline receipt can still be replayed.
- The app checks a saved due QR before displaying the scan image, and pauses
  its status reads when backgrounded. A QR or online checkout settles only
  after valid captured INR funds are reported. A gateway authorization that
  is still awaiting capture can be retried with the same confirmation.
  [Razorpay capture settings](https://razorpay.com/docs/payments/payments/capture-settings)
  [Razorpay payment fields](https://razorpay.com/docs/api/payments/fetch-with-id)

## Sessions and daily work

- Agent login verifies credentials before disclosing blocked or inactive
  status. New sessions carry unique IDs and a server-received logout revokes
  only its token. Password change and access revocation still invalidate all
  affected tokens. Existing tokens and clients use the same logout endpoint.
- Store registration suppresses repeated taps. If a reply is uncertain, the
  mobile client checks the submitted phone against active stores registered
  by that agent and confirms the name. It no longer fetches the full store
  list from an updated API. The registration coverage and 50-metre GPS rules
  are unchanged. Back controls handle deep links and the profile error screen
  still offers logout. Embedded maps reject unrelated external navigation.

## API compatibility and rollout

| Route | Change |
| --- | --- |
| `POST /auth/logout` | Revokes the authenticated Agent token |
| `GET /agent/store/my-stores?view=registration-check&phone=<phone>` | Scoped registration lookup |
| `GET /agent/orders/mine/:orderId/payment-qr` | Recover the pending Agent due QR or report a conflicting collector |
| `POST /agent/orders/mine/:orderId/payment-qr/:qrCodeId/close` | Close the caller's QR with gateway settlement checks |

Deploy the backend before releasing a signed Agent build. Old clients retain
their standard endpoints. Codes issued before durable due QR tracking remain
verifiable and cannot be discovered by the new recovery lookup. New-order
cash recovery is durable. Whole-app restart recovery of a new-order online or
QR checkout is still outside that coverage. Offline logout removes the local
token immediately and server revocation requires connectivity to the API.

The npm audit for the locked Agent build graph has zero critical findings.
It still reports 17 flagged packages in Expo CLI, Metro and prebuild tooling.
The existing Expo SDK and native versions were kept. Legacy identity uploads
and online payment sessions that never reach verification still require
separate storage and reconciliation work.

## Verification

The disposable backend suite passed 133 tests, and the Agent App suite passed
52 tests. TypeScript and the Android Hermes export passed. Payment checks used
gateway stubs and covered capture, currency, QR recovery, conflicting offline
collection, and permission-checked replays. A local registration fixture
returned 126 bytes for its targeted lookup versus 635 bytes for the full
store response. Another agent's phone returned no record. A revoked Agent
token returned HTTP 401 while a separate token remained valid.

The Motorola Edge 70 Fusion ran the current Expo Go bundle over USB. A test
order committed with a ₹51 total and zero advance while the fixture dropped
the reply. After force-stopping and reopening Expo Go, checkout recovered the
saved order and returned the original order ID. Stock fell from 25 to 24 on
the first submission and stayed at 24 after retry. No payment was created.
The earlier launch had reused an Expo Go cached bundle. The successful
repeat used a fresh local bundle URL. The test did not use production data,
real gateway payments or a signed Play Store binary.
