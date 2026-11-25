# Agent App production-readiness review

22 November 2026, Asia/Calcutta. Changes are in the workspace. The installed
Agent App and production backend are still on their current releases.

The [23 November follow-up](AGENT_PRODUCTION_FOLLOW_UP_2026-11-23.md)
adds Agent server logout revocation, durable cash and zero-advance checkout,
and recovery for new due-payment QR codes.

## What changed

- Payments retrieves only zero-balance, non-cancelled records for Completed.
  Due and Store Order History use compact rows with product names, saved due
  dates, order totals and cash verification. Order detail loads the full order
  through a permission-checked, indexed order-ID lookup. Its return card asks
  for the latest return on that order. Product search, full store histories,
  archived-history access and office verification rules remain available.
- Navigation badges get the unread count for the same newest 300 notifications
  the inbox uses. The inbox still reads the messages. The mobile profile
  requests only the identity, contact and photo fields the app displays and
  caches. It excludes bank details, PAN and Aadhaar URLs and application
  history. The mobile client strips those fields if an older server sends them.
- The default top-ten mobile leaderboard shares one in-flight calculation
  and caches its successful result for 30 seconds per API process. Only top
  agents' profile data is fetched. The tie-break and metrics stay intact.
  Dashboard date ranges shorter than ten years protect month generation,
  and leaderboard queries also reject excessively broad or reversed ranges.
- The app avoids retrying cancelled, authentication, validation and
  rate-limited reads. Transient read retries are staggered. The Completed
  tab avoids recalculating payment groups on the overdue clock.
- Rapid checkout taps start one attempt. QR polling stops when the phone
  goes inactive, cancels its pending status read and resumes when active.
  A payment already acknowledged before backgrounding still completes its
  verification. The collection screen now offers a retry if its saved
  payment check fails.
- Secure storage serializes writes. A late 401 or password-change response
  uses the originating session when clearing or replacing a token. Public
  login, password recovery and applications omit the Bearer token. Password
  setup, reset and change reject values over bcrypt's 72 UTF-8 bytes.
  Existing password hashes remain usable. The same check protects the
  existing shared Delivery reset implementation.
- Updated the locked Agent Zod, URI decoder, shell quoting and other
  compatible indirect dependencies. Expo SDK 56 and React Native 0.85 stay
  on their current versions. Expo Router's existing CommonJS query-string
  dependency uses a one-line patch to load the patched default export.
  The app retains the checked-in Expo Router startup patch.
  [URI decoder release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.1)
  [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
  [Shell quoting advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)

## API compatibility

The mobile client opts in on existing routes, and can read the original
responses during rollout. The backend keeps its existing unfiltered response
shapes. The date and password validation applies to shared routes.

| Route | Mobile query | Change |
| --- | --- | --- |
| `GET /agent/orders/my-orders` | `view=mobile-completed` | Compact zero-balance, non-cancelled orders |
| `GET /agent/orders/due-orders` | `view=mobile` | Compact outstanding orders |
| `GET /agent/orders/store/:consumerId` | `view=mobile` | Compact full history for the eligible managing agent |
| `GET /returns/my-returns` | `orderId=<id>` | Latest return visible to the order's store manager |
| `GET /agent/profile` | `view=mobile` | Limited self-profile fields |
| `GET /api/notifications` | `view=unread` | Unread count for the existing notification window |
| `GET /agent/leaderboard` | `view=mobile&limit=10` | Short-lived shared result for the default period |

## Verification

| Local synthetic check | Original | Updated |
| --- | ---: | ---: |
| Completed response from a 1,000-order history | 1,270,931 bytes | 346,792 bytes, 73% smaller |
| Store history of 1,000 orders | 1,270,937 bytes | 592,937 bytes, 53% smaller |
| Notification payload for the badge at 300 messages | 71,251 bytes | 19 bytes |
| Order aggregations during 100 concurrent leaderboard reads | 100 | 1 |
| Local leaderboard p95 with 100 agents, 10,000 fixture orders | 953 ms | 202 ms |

The concurrent leaderboard test used distinct authenticated fixture accounts
and returned matching rankings. Timings describe one local measurement,
including localhost Express and MongoDB. The test ran the original request
first after a warm-up. No production traffic was generated.

The isolated backend suite passed 125 of 125 tests and the Agent suite passed
49 of 49. Tests cover ownership, legacy API compatibility, payment
verification, returns, password handling, session races and mobile lifecycle.
Android Hermes export and TypeScript checks passed. Pixel 6 Expo Go
smoke testing used a local synthetic API for the dashboard, unread badge,
payment lists, full order details and QR collection. The fixture registered
zero QR status calls over seven seconds with the screen off. It resumed checks
after wake. No real gateway payment, cloud upload or production record was
used.

## Remaining before broad rollout

- Deploy the compatible backend and smoke-test a signed Android build on
  representative physical phones. This pass verified Expo Go and a local
  production bundle. It did not produce a signed AAB or run live payments.
- The npm audit fell from 28 to 17 package entries, including indirect
  dependants. No critical entry remains. The remaining direct advisories are
  under Expo's CLI, Metro and prebuild dependencies, including its separate
  Zod 3 copy. Resolving them requires a separately tested toolchain upgrade.
  [Expo SDK upgrade process](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- Legacy identity document URLs still need a coordinated private-storage
  migration. Mobile Logout clears the device token, while existing Agent
  JWTs are revoked by password and access changes. Individual server-side
  logout revocation needs its own migration. Mobile order placement also
  retains its existing in-memory retry reference for new cash orders. On an
  interrupted checkout, existing gateway reconciliation and office review
  are still needed if the app loses the session.
- The compact endpoints preserve complete per-agent histories. Very large
  single-agent histories or maps still require separate pagination and
  aggregate-count work. Measure VPS and database capacity in staging with
  representative order placement, stock contention, receipts and uploads.
  A suite run alongside the emulator returned transient store-lock conflicts
  in back-to-back write tests. Store-operation locks are released after the
  handler sends its response, so a follow-up can reach the API while the
  lock release is still in progress. Production lock semantics are preserved.
  The public OpenStreetMap tile service has best-effort availability and
  limited capacity. [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)
