# Admin review and release preparation — 25 November 2026

## Scope and fixes

Reviewed the existing Admin/Employee permissions, catalogue, dispatch mapping,
shared read/session helpers and earlier audit notes. Regression coverage spans
dashboard, agents/stores, employees, dispatch and delivery reports, Orders,
Bills, returns, cash verification/dues, product creation/editing, assignments,
targets, incentives, sales reporting and notifications. Tests use synthetic
HTTP/browser fixtures and disposable MongoDB; they do not exercise real
financial mutations.

- Delivery mapping now renders one page and supports searching agent ID/name
  and partner name. Name lookup uses maps instead of repeated array scans.
  Selecting, saving and confirmed revocation retain their existing contracts.
- Mapping writes reject blocked/deactivated/deleted agents, matching the
  selectable directory. Delegated employees use the same backend guard. Legacy
  active records with no accessStatus remain compatible.
- Product cards request 512-pixel bounded Cloudinary previews with automatic
  format/quality and no cropping. Signed, transformed and external URLs retain
  their delivery contracts; detail images remain full size.
- Catalogue cards and details correctly display a stored zero discount price.
  Chain details show the packet count in the existing Specifications section.

The release also includes pending, previously requested backend and Admin work:
Chain products/pricing, category minimum comparison data, compatible compact
mobile reads, per-device session revocation, idempotent checkout, and QR
reservation/reconciliation checks. Existing request formats remain supported.
Mobile source changes are not part of this website deployment and need separate
signed builds. See the 23 November mobile and Chain review notes for details.

## Measurements

Three local cold loads of 1,000 synthetic delivery mappings, Chrome at 1440×1000
and 4× CPU throttling. Same API fixture before and after:

| Metric | Before | After |
| --- | ---: | ---: |
| Median navigation-to-ready | 5,183 ms | 2,198 ms |
| Rendered mapping rows | 1,000 | 10 |
| Main-panel DOM elements | 7,050 | 2,128 |

This is approximately 58% lower median ready time in the fixture, not a claim
about production traffic. Dropdown options and the API still load the full
mapping directory. Large-directory server paging is a remaining scaling area.
Reproduce with `FrontEnd/scripts/measure-admin-mappings.mjs` and a local build.

## Validation and limits

- Backend: 136/136 isolated tests passed after the mapping guard correction.
- Frontend: 19/19 unit tests, Admin lint, new-script lint, production build and
  prerender passed. Full browser results are recorded in the release note.
- Full frontend and backend npm audits reported zero known advisories.
- The security review checked independent API permissions, session handling,
  HTML/link/CSV protections and payment constraints. Passing these checks is
  not proof that the application contains no vulnerabilities.
- Existing public identity-document URLs still need the coordinated storage
  migration described in `ADMIN_SESSION_HARDENING.md`. This release does not
  make those old URLs private. The large shared entry chunk also remains.

Deployment must preserve production configuration, take code/database backups,
stage dependencies, reload the API gracefully, retain prior browser assets,
and verify deployed file hashes and read-only office workflows.
