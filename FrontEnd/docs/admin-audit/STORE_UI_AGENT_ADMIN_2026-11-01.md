# Agent Stores and Admin store-request UI

1 November 2026. Local changes; no production deployment or APK replacement.
The owner requested clearer map/correction actions in the Agent Mobile App,
organized store cards, and a better Admin Store requests review screen.

## Existing features and changes

The Agent App already had a multi-store map and correction requests. This work
improves those features; it does not add a duplicate. Agent Web and Delivery Web
remain outside this task. No backend API or data model was changed.

Agent App:

- Stores has a labelled Add store button and a prominent green map card. Search
  also finds phone numbers/pincodes and shows the matching store count.
- Store names wrap separately from delivery codes. Contact/address, type/status,
  directions and order actions have distinct areas. Correction requests use a
  full-width icon/button with an approval explanation rather than plain text.
- Missing/failed photos show a placeholder; changing the image URL resets the
  failure state. Missing/invalid GPS disables directions and is excluded from
  the map. Archived stores cannot use the Create Order button.
- Map/list selections now synchronize with marker focus, popup and highlight.
  The selected-store card includes All stores, Directions and View orders.
  Map failures have an explicit retry; the WebView can shrink sufficiently to
  leave room for fallback controls and attribution.
- The correction form groups store/contact/address fields and explains approval.
  Its payload is built from explicit allowed fields rather than spreading an
  API address object. Local phone/pincode/GST/GPS checks match existing backend
  constraints, including GST clearing, accurate fresh location and no-op edits.
- Pending status always comes from the latest request page, even while browsing
  older history. All active request-history pages refresh after submission.
  Changed drafts after an uncertain failure receive a new request identifier;
  unchanged retries retain theirs. Successful submission clears transient photo,
  GPS and draft state, then displays pending history.
- Replacement photos require their accurate captured GPS before this mobile
  form submits. The photo picker cannot change a photo during submission/GPS
  capture. Existing server request formats remain compatible.
- Agent buttons have button accessibility roles/states, a minimum touch height,
  and text that can shrink/wrap within adjacent actions.

Admin Store requests:

- Status filter, total count and an invoice-history note form a clearer toolbar.
  Requests have status badges and separate field comparisons; before/requested
  values stack on phones and sit side by side on desktop.
- The reason field has an explicit themed background, placeholder, required
  explanation and character count. Approve/reject actions have distinct colors.
- Reads expose loading state and disable outdated review actions. A synchronous
  guard prevents duplicate review submissions. Filters stay locked while saving;
  reviewed pending cards disappear immediately while the list refreshes.
- Failed reviews show the server explanation inside the request and retain the
  reason. Historical reviews show reviewer, reason and date. Existing permission,
  approval/rejection, store version and historical-invoice behavior is preserved.

## Validation

- Full Admin browser suite: **136/136 passed**. New cases cover light 390px/dark
  1440px comparisons, long addresses, required reasons, one mutation under rapid
  clicks, filter locking, rejection history and stale-request errors.
  All four affected cases passed again after the final rejection-button color
  refinement; final screenshots were regenerated from that build.
- Admin lint and SPA build pass. The existing large-bundle warning remains.
- Agent TypeScript check passes. Three isolated Node validation cases cover
  allowed payloads, GST clearing, unchanged original data, malformed fields,
  photo/GPS requirements and stale/inaccurate/out-of-order GPS.
- Final Android JavaScript export succeeded in
  `output/agent-store-ui-2026-11-01/`. This is a JS bundle, not an APK or store
  release; no dependency or native-module update was required.
- Physical Android phone, Expo Go 56.0.4: inspected Stores, long names, highlighted
  map/correction actions, missing-photo fallback, correction form/keyboard,
  submission/pending history, older-history paging without bypassing pending,
  map tiles/markers, list-driven selected marker/popup, and hardware Back.
  A store's View Orders action also opened the correct empty store-order list
  and returned to Stores successfully.
- Device business requests used only a disposable loopback fixture API. The
  existing installed production package was not replaced. OSM map tiles were
  loaded normally; no production application API was contacted by this test
  bundle. Precise outdoor GPS/camera submission, external navigation and a
  signed release APK were not validated by this UI check.

Evidence is under `FrontEnd/.admin-audit.local/`: `agent-stores-424.png`,
`agent-correction-settled-424.png`, `agent-history-pending-page2-424.png`,
`agent-map-overview-424.png`, `agent-map-selected-424.png`,
`agent-stores-missing-photo-424.png`, and the Admin comparison screenshots.
Some initial captures were taken during navigation/reload animations; settled
captures are the layout evidence. Temporary credentials/env files were not
copied into this report.

The optional local phone preview uses Metro port 8083 and fixture API port 4196,
with USB reverse mappings for those ports. It is separate from the production
app. Device USB stay-awake was restored to its prior value after testing.
