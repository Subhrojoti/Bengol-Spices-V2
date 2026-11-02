# Production release: Employee access, stock checks and delivery-code lookup

Released and verified: 2 November 2026 (Asia/Calcutta).
Application commit: `2c40b987b5fe74fb6172534a82b7f60f45c8fde1`, pushed to main.

## Scope and recheck

- Rechecked the approved employee permission and active delivery-code changes;
  no additional code bug was found. Full backend 106/106, full Admin/Employee
  browser suite 168/168, frontend units 13/13, Admin/Employee lint and SPA build
  pass. Browser tests use intercepted synthetic APIs; backend tests use
  disposable MongoDB and mocked financial services.
- Includes the pending backend stock/catalogue correction and EAS upload
  exclusions. No mobile source changes or signed APK/AAB release. A mobile
  rebuild is not needed for these server/web fixes.
- Employee business tools now follow their permissions, including Orders,
  agent/store management, mappings/settings, partner cleanup and product minima.
  Employee account/permission administration stays Admin-only. Existing grants
  were not changed or automatically expanded in the database.
- New `canResolvePaymentIssues` stays OFF unless explicitly granted. Refunds/
  settlement require it together with `canSeePaymentInfo`; audited actions retain
  the actual actor and existing gateway replay safeguards.
- Orders > Delivery codes requires `canGetAllOrders` and `canViewDeliveryCodes`.
  Only non-terminal orders appear; code retrieval rechecks active status and
  saves the access audit first. Existing detail/report reveal remains.

## Deployment evidence

- Production website built/prerendered from the pushed commit archive. API staged
  separately with locked production dependencies. Read-only database, storage,
  gateway and email credential checks passed; no payment or email was sent.
- Verified API/website/database backups before switching. No index migration,
  permission backfill, business-record rewrite, nginx or production-setting change.
- API gracefully reloaded. All 184 backend and 220 website files match release
  hashes. Previous JS/CSS assets retained for already-open pages. API online at
  PID 128340, restart count 6; unrelated HR process unchanged at PID 81281/count 0.
- Normal live Admin login, employee permission-editor read (22 switches, including
  the new refund flag), active-code metadata/view on desktop/phone, terminal-filter
  exclusion, Orders, Bills/filtered ZIP, collector tabs, store reports/requests,
  mappings and partner reports/items/collections passed.
- Code list contains no verification codes. Live verification deliberately did
  not reveal real codes, save employee permissions or perform business mutations.
  Unauthorized requests were refused; zero page errors/API server errors in the
  smoke. The verification login was revoked and replay refused afterward.
- Employee permission success/revocation/denial cases were verified with isolated
  accounts, not by impersonating production employees. Live Employee entry page
  and exact deployed source were checked.
- HTTPS API/database health, HTTP/2, public/About and Admin/Employee/Agent Web/
  Delivery Web entry pages pass. Production configuration fingerprint unchanged.

## Recovery and use

- Private API/website archives:
  `/root/bengol-release-permissions-codes-20261102/api-before.tgz` and
  `website-before.tgz`, with matching `website-before.build-assets`.
- Previous full API/dependencies:
  `/var/www/Bengol-Spices-V2/BackEnd.previous-permissions-codes`.
- Previous website:
  `/var/www/Bengol-Spices-V2/FrontEnd/dist.previous-permissions-codes`.
- Database backup: `/var/backups/bengol-spices/2026-11-02_1806`, 987 documents
  across 30 collections. All gzip archives passed integrity checks.
- Prefer a forward fix. If rollback is necessary, review live business activity
  and restore matching API/site versions; never overwrite new production
  payments/orders with an older database backup blindly.
- Refresh open office panels to load the release; sign in again if permissions
  were changed. Admin can enable the separate refund permission for selected
  staff. Refresh/reopen the Agent catalogue to discard its existing short cache.

Implementation details: [employee/stock changes](../../BackEnd/docs/EMPLOYEE_ACCESS_STOCK_FIX_2026-11-02.md)
and [active-code lookup](../../BackEnd/docs/ACTIVE_DELIVERY_CODES_2026-11-02.md).
Operational helpers and detailed test logs are retained in ignored
`FrontEnd/.admin-audit.local/release-permissions-codes-20261102/`.
