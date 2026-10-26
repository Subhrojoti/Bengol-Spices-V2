# Admin store-photo preview — 26 October 2026

Status: pushed, deployed and verified on 26 October 2026, application commit
`9d4754e`. See [production evidence](../../../deploy/releases/2026-10-26-store-photo-preview.md).
The backend remains on its previous release; this deployment did not reload it.

The existing UI had static store avatars and no photo preview. Clicking a store
photo now opens its original URL in a responsive modal in Admin Orders, Returns,
Payment Info and Delivery. Missing photos keep the existing initials fallback.
Failed originals show a dismissible error and can be retried. Close using the X,
Escape or backdrop; the existing MUI Dialog handles focus, scroll lock and return
to the trigger. Keyboard Enter/Space activates the photo button.

`components/common/StorePhoto.jsx` owns one modal in `AdminBase`. The provider's
stable callback avoids creating a dialog per row; the preview image mounts only
when opened. Orders retain their existing bounded, lazy thumbnail URLs,
indexed/deferred search, memoized cards and pagination. Full preview URLs accept
only HTTP(S), using the existing safe URL helper.

Selection buttons and photo buttons are separate controls, so opening a photo
does not select/collapse the store or dispatch card. The visual card layout is
retained. These tab screens are shared with Employee; without the Admin provider
they keep static avatars and the existing selection-button rendering. No agent
or delivery portal source, backend endpoint, database field or business rule was
changed. Pre-existing mobile and Product Sales edits remain untouched.

Browser coverage in `tests/browser/store-photo.spec.mjs` uses synthetic images and
intercepted APIs: four section previews, original-image delivery, selection
isolation, keyboard/focus, phone bounds, missing photos, failure/retry, and no
business mutations. Existing order/return/dispatch workflows exercise the separate
card-selection control. Validation results are recorded after execution below.

Initial local validation: Admin lint and the production SPA build (`npm run build:spa`) pass.
All 64 existing Admin browser cases pass. Six new photo cases passed on the first
run; the missing-photo case initially had an ambiguous text locator (the same
store name appears in navigation). Its locator was scoped to the selection button,
and all seven photo cases then passed in the focused Chrome run, including the
added phone backdrop-close check. No application code changed for that test fix.
All APIs/images were intercepted; no production session or record was touched.
The existing shared-entry bundle-size warning remains. Prerendering, live-host
smoke checks and deployment were not performed during that initial local phase.

Release verification subsequently passed the complete build/prerender and all
71 Chrome cases against an isolated release without the owner's unrelated local
Product Sales/mobile edits. All 205 website file hashes matched deployment.
Real Admin sign-in, existing store-image loading, selection isolation, Escape,
phone sizing/Close and logout passed on the production host. No business records
were changed. The release report records rollback files and process/page health.
