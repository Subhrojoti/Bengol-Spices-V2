# Production release: Delivery QR and Admin Bills

Application commit: `b074409af3146a6d6a4a99ea5f32e6065fafe657`, pushed to main.
Deployment completed on 1 November; final connected-phone QA completed on
2 November 2026 (Asia/Calcutta).

- Backend and website deployed from the committed archive. Includes Delivery
  UPI QR APIs, Admin Bills with individual/filtered ZIP downloads and employee
  permission, and Agent/Delivery collector tabs in Cash Verification. Existing
  permission-controlled Orders delivery-code reveal was reused.
- Production settings and nginx configuration unchanged. Database/source/site
  backups completed before rollout; additive indexes created without dropping
  indexes or rewriting business records. API gracefully reloaded.
- All 182 backend and 219 website files match release hashes. Previous website
  assets retained for open tabs. API online; unrelated HR service unchanged.
- Live normal Admin authentication, store reports/requests, mappings, partner
  reports/items/collections, Orders/status filters, Bills list/detail/filtered ZIP,
  Delivery collector tab and mobile-width Store Details passed. Unauthenticated
  report/QR requests refused. No business mutation, page error or server error
  occurred in this smoke; its verification session was revoked afterward.
- HTTPS health reports database connected. Public/About and Admin, Employee,
  Agent Web and Delivery Web entry pages return 200; HTTP/2 verified.
- Local validation: backend 98/98, Delivery mobile regressions 11/11 and
  typecheck, Admin units 13/13, lint/build and nine final affected browser checks
  pass. The initial broad browser run was 151/155; all four failed cases were
  corrected and included in the affected rerun, not a second complete run.

## Connected-phone QR validation

The owner made the Android phone available. Expo Go ran the current Delivery
source against the real backend routes with a disposable Mongo replica set and
fully mocked payment gateway. No production business records or real payments
were involved.

- Signed into the synthetic partner account and opened an assigned test order.
- Generated a partial INR 25 QR against INR 190 outstanding. Inspected the
  portrait modal: QR image, amount, order ID and action buttons are readable and
  contained within the screen.
- Hide/resume retained the same single QR and blocked a competing manual
  collection while pending.
- Simulated captured UPI auto-confirmed on the phone: recorded INR 35, verified
  INR 25, pending offline verification INR 10, outstanding INR 165.
- Original sales agent retained credit; delivery partner was the collector.
  Two further verification replays left exactly one gateway payment and the
  same outstanding balance. Initial QA helper assumed offline verification
  metadata on gateway payments; corrected it to assert the actual payment
  history's verified totals. No application change was needed.
- The isolated emulator had OS startup/memory issues and was stopped; the final
  native check used the physical phone. No emulator-pass claim is made.

The mock QR encodes harmless test text. Real banking-app scanning, merchant QR
enablement and live gateway settlement remain untested. A production-API Android
Hermes export succeeded, but no signed APK/AAB was built or published. Installed
apps need the new Delivery build; VPS deployment alone does not update them.

## Recovery

- API backup: `/root/bengol-release-qr-bills-20261101/api-before.tgz`;
  previous source/dependencies: `/var/www/Bengol-Spices-V2/BackEnd.previous-qr-bills`.
- Website backup: same private release folder, `website-before.tgz` and
  `website-before.build-assets`; previous dist retained beside live dist.
- Database: `/var/backups/bengol-spices/2026-11-01_1756`, 872 documents across
  30 collections; all gzip archives passed integrity checks.
- Prefer a forward fix. Do not blindly restore the old API after new QR attempts
  exist: old code cannot recover their gateway state. Review business activity
  before rollback; never restore an old database over new production payments.

See [QR behavior and safeguards](../../BackEnd/docs/DELIVERY_QR_RELEASE_2026-11-01.md)
and [Bills/collector implementation](../../BackEnd/docs/BILLS_COLLECTOR_TABS_2026-11-01.md).
