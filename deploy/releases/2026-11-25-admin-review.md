# Admin and compatible backend release — 25 November 2026

Application `8ae719369b1ccd735f59b4517a19e0d836743dc5` was pushed to `main`
and deployed to the VPS. The website/API were replaced together with a graceful
PM2 API reload, automatic rollback checks and retention of prior JS/CSS assets
for already-open browser tabs.

## Included changes

- Searchable, paginated delivery mapping rows; linear name lookup. In three
  synthetic cold Chrome loads with 1,000 mappings and 4× CPU throttling, median
  ready time fell from 5,183 ms to 2,198 ms. Rendered mapping rows fell from
  1,000 to 10. This is a local measurement, not production traffic telemetry.
- Mapping saves reject blocked/deactivated/deleted agents through the API.
- Catalogue cards load bounded Cloudinary previews without cropping, preserve
  signed URLs, and display stored zero discount prices correctly. Product
  specifications include Chain packet counts.
- The pending Admin Chain creation/editing flow and compatible backend work
  are included: canonical Chain pricing, minimum comparison data, compact
  mobile reads, checkout retry integrity, per-device revocation and QR
  reservation/reconciliation safeguards. Existing client formats remain
  accepted. No business-data migration or settings change was performed.

Pending Agent/Delivery application source was preserved locally. Mobile UI
features still require their signed app builds; a VPS release does not update
installed apps. Detailed scope: [review](../../BackEnd/docs/ADMIN_REVIEW_2026-11-25.md).

## Verification

- 184/184 Admin/Employee browser tests, 136/136 isolated backend tests and
  19/19 frontend unit tests passed. Admin lint, measurement/test-script lint,
  production build and prerender passed.
- Full frontend and backend npm audits returned zero known advisories.
- The archive's 526 tracked frontend/backend files match the tested source;
  357 differed only by Windows/Git newline conversion. All 197 deployed API
  files and 222 website files match the release archive/build exactly.
- Staged database, Cloudinary, Razorpay and Resend configuration checks passed.
- Public, Admin, Employee, Agent Web and Delivery Web entry pages returned 200;
  API/database health and HTTP/2 checks passed.
- Live read-only smoke passed for store dues/history, Bills, returns, stores,
  change requests, mapping, partner performance/items/collections, Orders,
  active delivery codes and the employee permission editor. Unauthorized
  requests were refused. No business mutation, browser error or server error
  occurred. The temporary verification session was revoked.
- Production configuration fingerprint and unrelated HR process were unchanged.

Existing public identity-document URLs still need the coordinated migration
described in [the security notes](../../BackEnd/docs/ADMIN_SESSION_HARDENING.md).
The mapping directory still loads all dropdown options; some other endpoints
also return whole collections. The shared entry chunk remains above the build
warning threshold. These checks do not prove unlimited scaling or absence of
every possible vulnerability.

## Backups and rollback

- Private release/backup directory: `/root/bengol-release-admin-20261125`.
- Verified database backup: `/var/backups/bengol-spices/2026-11-25_1040`,
  1,914 documents across 30 collections; gzip integrity passed.
- Previous API: `/var/www/Bengol-Spices-V2/BackEnd.previous-admin-20261125`.
- Previous website:
  `/var/www/Bengol-Spices-V2/FrontEnd/dist.previous-admin-20261125`.
- Restore the API and website together if needed and gracefully reload
  `bengol-api`. Preserve current production configuration. Consult ongoing
  office activity before considering a database restore; deployment itself
  neither restored nor migrated business records.

Local detailed logs and measurement/verification JSON are retained in
`output/admin-20261125-*` and
`FrontEnd/.admin-audit.local/release-admin-20261125/` (ignored by Git).
