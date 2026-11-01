# Agent and Delivery mobile final QA — 1 November 2026

## Scope and release status

The owner made the Android phone available for a final review before creating
Play Store AAB updates. Reviewed both mobile applications and exercised their
actual backend routes against a **disposable local MongoDB replica set**.
No production data was written, no production package was replaced, and nothing
was pushed, deployed, built as a signed APK/AAB or submitted to Play Console.

The earlier ecosystem/backend changes remain local according to the repository
continuation notes. **The matching backend must be deployed and verified before
the updated mobile applications are rolled out to users.** This QA server uses
the current local backend and does not prove those endpoints exist on the VPS.
In particular, editable drafts, confirmation-time invoices, store corrections,
category minimums and partner instalment APIs depend on that backend release.

## Corrections in this pass

### Agent App

- Fixed the same stale-login response race previously fixed in Delivery: an old
  request's 401 cannot sign out a newer session. Explicit logout authorization
  is preserved. Current-session expiry and wrong-password handling still work.
- Date formatting tolerates missing/malformed legacy dates instead of throwing
  from order, history and notification screens. Saved due dates remain the basis
  for overdue checks. Existing missing-date dash formatting is retained.
- Fixed blank collection fields silently defaulting to the complete outstanding
  balance. Amounts are explicit, exact to paise and bounded by the current due;
  a separate Use full balance button fills the field deliberately. Only Cash
  can settle an exact final balance below ₹1, preserving existing rules.
- Saved Cash retry attempts restore their displayed amount and method with the
  same request ID. Unsupported/corrupt saved methods block recovery instead of
  being silently converted. Order route keys isolate form state; a synchronous
  submission guard prevents repeat Cash sends, and success stays guarded until
  navigation completes. Late completion cannot navigate away from another screen.
- Invalid order dates no longer throw while constructing collection feedback.
  Unknown dates receive neutral office-verification wording.
- Dashboard labels now say **Collections recorded / Recorded**, matching the
  backend's recorded amount rather than implying all cash has been verified.
  Delivery/return donut totals are labelled **Records**, with an explanation
  that one order can appear in both categories. Financial calculations did not
  change.

### Delivery App

- Rechecked the earlier payment recovery, navigation, map, photo and date fixes
  using real isolated backend routes rather than only static response fixtures.
- Corrected the singular active-destination map caption. No business workflow or
  permission change was needed in this pass.

No dependency or native-version upgrade was introduced. The pre-existing Agent
Expo Router patch and its postinstall setup were preserved; the installed module
contains the patch. Existing unrelated work and the pre-existing staged store-
route rename were retained.

## Physical Android checks

Used Expo Go through USB reverse: Agent Metro `8086`, Delivery Metro `8087`, local
API `8768`. The isolated server clears configured service credentials/database
URLs, uses an in-memory replica set, mocks Cloudinary locally, and rejects gateway
calls. All business accounts, stores, orders, receipts and returns are synthetic.

### Agent

- Login, overview, populated monthly chart, recorded-collection labels, Stores
  search/cards, store-to-order navigation, order details and warm deep links.
- An undersized edit (9 packets against a 10-packet minimum) disabled Save.
  Saving 20 packets changed the draft from ₹200 to ₹400, revision 0 to 1, while
  the original ₹10 payment remained unchanged. The previous contents appear in
  modification history.
- Local office confirmation locked editing and enabled the invoice. The invoice
  API returned HTTP 200, `application/pdf`, about 122 KB; the native download
  opened sharing UI, which was cancelled without sharing to anyone.
- Blank Cash amount disabled recording. An explicit ₹20 instalment under rapid
  repeat tapping created only one additional receipt. The order showed ₹30
  recorded and ₹370 due, with the original ₹10 receipt intact.
- Local office approval of the ₹20 receipt made Targets show ₹20 collected;
  remaining receipts stayed pending. A populated ₹1,000 mandatory target, Wallet,
  grouped Payments, Returns and Help rendered successfully.
- The Agent map showed the three stores managed by that Agent.

### Delivery and cross-app consistency

- Login, dashboard with all 12 monthly labels and three yearly bars, active-work
  list, and assigned → shipped → out-for-delivery controls.
- A wrong handover code was refused with four attempts remaining; the valid code
  completed the separate handover order. The saved due date became 8 November,
  seven days after the successful 1 November handover.
- A ₹10 recorded UPI instalment after delivery succeeded, leaving ₹20 recorded
  (including the earlier Agent receipt), ₹0 verified, ₹20 pending and ₹180 due.
  Partner collection history showed the actual delivery partner as collector.
- Local office approval of that UPI receipt credited the **original sales Agent**:
  their verified target collection rose from ₹20 to ₹30. No second collection was
  created by verification.
- Populated completed-return history rendered. The active return advanced through
  Picked Up → Received at Warehouse → Completed using confirmations. Both test
  returns then had COMPLETED status in the isolated database.
- The active Delivery map excluded delivered/unassigned orders and showed the one
  remaining active destination. Map credits and normal tile loading were present.

## Offline/build checks

- Agent typecheck and **13/13** regression tests pass. Tests cover date handling,
  explicit payment amounts, saved due-date interpretation, India-month boundaries,
  session response races and existing store-correction/GPS validation.
- Delivery typecheck and **9/9** regression tests pass, covering prior map/amount/
  date/session fixes and the release API-address guard.
- Both release-address tests prove a non-development bundle falls back to the
  HTTPS live API when given an empty, loopback or plaintext office address.
- Both production-mode Android JS exports pass with dotenv disabled and the HTTPS
  production API configured. Outputs: `output/mobile-final-agent-2026-11-01` and
  `output/mobile-final-delivery-2026-11-01`. These are **JS exports, not AABs**.
- Both Expo native config introspections pass. Existing package IDs and EAS
  production HTTPS/auto-increment settings are retained. Agent microphone access
  is explicitly removed (`tools:node="remove"`); camera permission comes from the
  installed image-picker library manifest. GPS permissions are declared.
- Expo CLI reports newer SDK patch versions. No automatic upgrade was made during
  this release QA, particularly because Agent's existing Router patch is versioned.
  The current installed versions were the ones exercised and exported here.

Logs/screenshots/config inspection files are local under
`FrontEnd/.admin-audit.local/mobile-final-*` and `final-agent-*` / `final-delivery-*`.
No production secrets or fixture access tokens are copied into this report.

## Precise remaining release checks

This establishes local functional/UI confidence, **not signed-build or Play Store
acceptance**. A signed internal build still needs installation and smoke testing
before production rollout, including actual camera/photo upload and accurate
outdoor GPS registration (fresh reading within 50 metres). The phone could not
obtain a GPS fix during this handover check. The isolated backend's existing
non-blocking delivery-location setting allowed handover with an office-review
flag; this does not verify the positive 50-metre registration path and no location
rule was weakened. User-facing GPS failure feedback was visible.

Real Razorpay/QR settlement, push delivery, signed APK/AAB installation, release
native-library/Play Console validation and a VPS smoke test were not performed.
No iOS, tablet or large-system-font certification is claimed. Earlier focused
reviews contain additional coverage; see the Agent Stores and Delivery review
notes linked from BACKEND_CONTEXT.md.

Device temporary XML/PNG files and test stay-awake settings are restored/removed
at the end of the pass. Development previews remain separate from production.
