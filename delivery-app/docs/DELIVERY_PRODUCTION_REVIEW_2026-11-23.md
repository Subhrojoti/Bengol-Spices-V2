# Delivery App production review

23 November 2026, Asia/Calcutta. This review covers Delivery mobile and its
API paths for onboarding, session access, assigned work, delivery confirmation,
failure reports, GPS and maps, return pickups, cash and UPI collections,
history, notifications, and profile. The changes are in the local workspace.

## Fixes

- A Delivery QR reserves the order against further offline receipts while the
  gateway outcome is unresolved. An already-recorded receipt can be replayed
  using its saved request ID. QR status and verification use the locally stored
  order/collector association before contacting Razorpay. Applied, refunded
  and office-resolved codes can reconcile using the saved outcome.
- The current assignee can trigger recovery of an expired QR left by another
  partner without receiving that partner's QR or payment details. A reservation
  only clears when the gateway confirms the code is closed, its captured total
  is zero, and its payment list shows no attempt still in progress. A provider
  error keeps the reservation intact. [Razorpay QR entity fields](https://hdfcbank-collectnow-docs.razorpay.com/api/qr-codes/entity/)
- Mobile checks a saved QR before displaying the payable image. QR status polling
  stops when the screen closes or the app goes inactive, and any status read in
  progress is cancelled. Verification finishes if the app already observed funds.
- A successful server logout revokes the specific token on that device, including
  tokens from existing installed builds. New tokens include a unique session ID.
  Password changes still revoke all previous tokens. The app serializes secure
  storage writes and prevents delayed unauthorized responses from clearing a newer
  session. Public authentication and application requests omit the Bearer token.
- Delivery login confirms credentials before revealing approval status. Applying,
  resetting and changing a password enforce bcrypt's 72-byte input limit for new
  passwords. Existing credentials can still sign in. Signed-in users can log out
  if the profile request fails.
- The mobile profile requests only contact, address, status and masked identity
  fields. Old server responses are stripped before reaching the application cache.
  Web and older mobile clients keep the original response.
- Opening an order or pickup requests only that record, including during history
  recovery after a lost reply. The badge uses the existing `view=unread` summary,
  while the inbox retains message content. Query retries focus on transient network
  and server errors. Dashboard icon labels and deep-link back navigation were fixed.
- Embedded map navigation now goes through the app's explicit URL check. The
  map credits remain available and unrelated links cannot launch another app.

## Compatible API options

| Route | Mobile option |
| --- | --- |
| `GET /delivery-partner/profile` | `view=mobile` |
| `GET /delivery-partner/orders` | `view=mobile-planning&orderId=<id>` |
| `GET /returns/delivery/assigned` | `returnId=<id>` |
| `GET /delivery-partner/history` | `orderId=<id>` or `returnId=<id>` |
| `GET /api/notifications` | Existing `view=unread` |

Omitting options keeps the existing response shape. Old backends may return the
original list during rollout. The mobile client still finds the selected record
locally and uses the authenticated partner's normal permissions.

## Dependency and release verification

The npm audit fell from 30 to 16 flagged package entries, with the only critical
entry cleared. Updated compatible dependencies include Zod, the URI decoder,
shell quoting, XML parsers, and CSS/build utilities. The SDK 56 router uses the
same checked-in compatibility patch as Agent to use the updated URI decoder.
The remaining advisories are in Expo CLI, Metro and prebuild dependencies,
including the CLI's separate Zod copy. Expo's SDK compatibility check also flags
the existing `react-native-screens` 4.26.2 pin against its 4.25.2 recommendation.
This patch keeps the previously used native versions. Validate a signed Android
build before publishing and verify navigation and maps during that check.
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
[Shell quoting advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)
[URI decoder release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.1)

The isolated backend suite passed 130 tests and the Delivery suite passed 27.
TypeScript and the Android production Hermes export passed. Tests cover multiple
sessions, logout revocation, scoped detail reads, payment replay, aborted status
reads, and recovery of expired or already-settled QR codes with gateway stubs.

A Motorola Edge 70 Fusion running Expo Go opened the test account, assigned
list, order details and map against the disposable local backend. The order's
collection history and ₹198 outstanding balance appeared. The payment
mutations in this review were verified by isolated automated tests. A separate
local request confirmed a logged-out token returned HTTP 401.

For a three-order fixture, the assigned list response was 4,067 bytes and the
single-order request was 1,801 bytes. The same profile was 511 bytes in the
legacy response and 282 bytes in the mobile response. These are response sizes
from a local fixture.

Roll out the backend before the next signed Delivery build. The related store,
Chain and planning changes share the workspace and are documented separately.
Signed Play Store builds, real gateway payments and production data were outside
these checks. The History tab still reads the full list when deliberately opened.
Legacy identity uploads still need a private-storage migration. Logout on a phone
without connectivity clears its local token immediately, and server revocation
requires the logout request to reach the API.
[Store, Chain and delivery workflows](../../BackEnd/docs/STORE_CHAIN_DELIVERY_WORKFLOWS_2026-11-23.md)
