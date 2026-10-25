# Orders store-list performance

25 October 2026. The owner reported lag while scrolling stores in the Orders
section. Changes target the admin/employee web Orders screen, not mobile apps.

## Findings from source

- The store sidebar already paginated to ten cards by default. Rendering an
  unlimited number of cards was not the immediate issue in this implementation.
- EntityAvatar displayed original uploaded store photos at 48 CSS pixels.
  Uploads can be camera-sized files; lazy loading deferred their download, but
  did not reduce image bytes, decoded size or decoding work as they entered view.
- Store search/pagination state lived in OrderManagement. Changes reconciled the
  whole Orders screen, including expanded product/status-history sections.
- Scrolling used a nested overflow viewport without scroll containment, allowing
  wheel movement at the list boundaries to continue scrolling the main page.

These are observed source costs and plausible causes of stutter, not a measured
browser CPU/frame-rate profile. No browser was available during this session.

## Changes

- OrderStoreSidebar.jsx is a memoized component with local search/pagination.
  StoreCard is memoized with a stable selection callback, so unrelated order
  dialog/action updates do not redraw all store cards. Search filtering is
  deferred and uses a precomputed text index that includes store/agent/order IDs.
- imageThumbnail in utils/image.js requests a centered 144×144 Cloudinary preview
  for the 48-pixel avatar (up to 3× density), with automatic format and quality.
  The original URL/data is not modified. External, signed, authenticated,
  query-bearing and already-transformed URLs remain unchanged.
- EntityAvatar now requests asynchronous decoding. Its optional fallbackSrc
  retries the original image if preview delivery fails, then retains the existing
  initials/icon fallback. A keyed image child resets errors when URLs change,
  avoiding the prior state-reset effect. Other callers keep their existing image
  URLs and styling; only Orders requests these new thumbnail URLs.
- OrderStoreSidebar.css confines layout/paint to the list viewport, keeps the
  scrollbar gutter stable, and contains vertical overscroll. Existing card
  dimensions, sticky layout, pagination and responsive sizes remain.
- Store selections, deep-linked/queue orders, status filters, exports, refresh,
  confirmation/cancellation and invoice actions remain in OrderManagement.
  Sidebar reveal requests retain deep-link pagination. No scroll handler or
  frame-by-frame React state update was introduced.
- Cancellation form reset now follows a changed order before painting rather
  than scheduling a second render from an effect; the form's validation and API
  contract are unchanged.

No backend/schema/API changes, new packages or production operations were needed.

Cloudinary parameter behavior was checked against the official
[transformation reference](https://cloudinary.com/documentation/transformation_reference)
and [image optimization guide](https://cloudinary.com/documentation/image_optimization).
If a deployment restricts dynamic transformations, the original-image fallback
preserves photos, but thumbnail bandwidth improvements require permitting that
delivery transformation. No storage account settings were changed.

## Validation and next check

- FrontEnd `npm test`: 3 tests passed, covering bounded thumbnail sizing,
  preservation of original asset paths, signed/external/authenticated delivery
  contracts, existing transformations and versionless legacy Cloudinary URLs.
- ESLint passed for the changed Orders, sidebar, avatar, image utility and tests.
- `npm run build:spa` passed. Existing large-bundle warning remains; backend tests
  were not rerun because this change modifies no backend behavior.
- Still verify real scrolling on the affected browser/device, with normal and
  slow network conditions, and inspect the Network panel for 144×144 previews.
  Check store selection, next/previous pages, search by order ID, queue/deep-link
  navigation to an order on a later page, image-error fallback and both themes.
  No measured FPS/latency improvement or interactive browser QA is claimed.

Files: pages/Admin/Tabs/Orders/{OrderManagement,OrderStoreSidebar}.jsx;
OrderStoreSidebar.css; components/common/EntityAvatar.jsx; utils/image.js;
tests/image.test.js; package.json (adds the frontend test command).
