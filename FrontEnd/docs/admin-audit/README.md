# Admin frontend audit and continuation guide

Audit date: **26 October 2026**. Starting repository HEAD: `efbebbf`.
**Follow-up:** the owner authorized backend/Admin-only security fixes after this
audit and explicitly excluded agent/delivery web versions. The CSS parser advisory
is now patched (full audit zero; CSS output unchanged), and new Admin sign-ins use
HttpOnly server sessions. See [the follow-up report](../../../BackEnd/docs/ADMIN_SESSION_HARDENING.md).
The original scope, measurements and retained issues below are the initial audit
snapshot; the follow-up report and validation record supersede its dependency and
Admin-token-storage statements. Unrelated portal lint issues remain out of scope.
This records a local source audit and synthetic browser validation, not a live
production security certification. No deployment has been performed for this task.

## Final backend/Admin security follow-up

New Admin logins use an HttpOnly server session with durable logout revocation,
expiry, credential-change invalidation and Origin/custom-header CSRF checks.
Existing bearer clients remain compatible. The cookie is verified before login
completes; blocked cookies and failed logout show actionable errors. New session
credentials are not placed in JavaScript storage. See the linked backend report
for the additive endpoints, collection, deployment order and rollback limits.

Final checks: 64/64 browser tests in Chrome, 64/64 in Edge, four focused React
StrictMode checks, nine frontend unit tests, clean Admin lint, and the production
build including prerendering. The backend suite includes the five new isolated
cookie-session tests. Browser APIs are mocked; production HTTPS/CORS/proxy cookie
behavior still needs staging verification before deployment.

Full frontend and backend dependency audits report zero known vulnerabilities.
The parser override installs from the lockfile and produces byte-identical CSS
(97,226 bytes). Business-helper fingerprints remain unchanged. Historical timing
measurements below were not rerun for this security follow-up. The 13 unrelated
portal lint errors/two warnings and public identity-document migration remain
documented limitations. See [validation.json](validation.json),
`securityFollowUp`, for the current results.

## Scope and recovery

Read this file before continuing Admin work, then inspect the affected source and
its diff. The full brief requires frontend-only changes, preserved design,
business rules, roles and API contracts, measured performance, and regression
coverage before release. Backend, agent app, delivery app and server configuration
are outside scope. Existing unrelated mobile edits and the pre-existing Product
Sales agent drilldown/Back changes were preserved.

- [Source inventory](source-inventory.json): all 36 Admin JavaScript/JSX modules
  and their statically reachable shared dependencies, source hashes, imports and
  review signals. All 154 first-party frontend modules were parsed. Reachability
  and signal counts alone are not evidence of runtime coverage.
- [Unchanged core](unchanged-core.json): baseline comparison for target arithmetic,
  target metadata, permission keys, CSV escaping, HTML sanitization and the
  existing paginated/memoized order store list. These were retained.
- The frozen pre-change source/build and temporary test artifacts are under the
  ignored `FrontEnd/.admin-audit.local/`. The temporary dependency junction was
  removed after verification, leaving the real `node_modules` intact. If recreating
  `baseline-source/node_modules` as a junction to rebuild the snapshot, remove that
  junction itself before recursively cleaning the benchmark directory.
- Repeatable checks: `npm test`, `npm run lint:admin`, `npm run test:admin`, and
  `npm run build`. Browser checks use installed Chrome; set `ADMIN_TEST_CHANNEL`
  to `msedge` for installed Edge. Tests intercept external services and use only
  synthetic records. There is no configured TypeScript check for this JSX app.

## Implemented changes

### Loading and rendering

`config/adminRoutes.js` and `routes/areas/AdminArea.jsx` now load each Admin section
and product detail screen independently. Agent, Delivery and Targets also split
their nested tabs, so Management/Dispatch/target creation do not load unused charts
and dialogs. `AdminSectionBoundary` keeps navigation available during loading,
failed chunks and render failures; recovery reloads the current build because
React caches rejected lazy imports.

Existing pagination, indexed/deferred order-store search, bounded thumbnails,
memoized table/chart computations and theme behavior were reviewed and retained.
No extra virtualization or blanket memoization was added. Most large tables
already render one page, and the order store search already owns its state.
The existing shared entry chunk remains above Vite's 500 kB advisory threshold;
the warning was retained rather than hidden or resolved with unrelated rewrites.

### Requests and state

`useLatestRequest` aborts superseded/unmounted reads and gates success, failure and
loading updates. It is used throughout the Admin data loaders. Optional Axios
options carry cancellation without changing endpoints, parameters or DTOs.
Location lookup requests have bounded timeouts, cancellation and selection guards:
a slow earlier agent/state can no longer overwrite the current city/pincode list.

The Admin read coordinator shares only simultaneous identical reads, keyed by
token, URL, parameters and response type. Completed reads are removed; mutations
invalidate pending reuse. Independently cancellable requests do not share another
component's AbortSignal. There is no persistent stale-data cache. Admin GETs have a
30-second timeout; mutation timing and retry semantics are unchanged.

Cash filters stay usable while data refreshes; outdated rows are visibly busy and
inert, and bulk actions are disabled until the response matches the selected
filters. Missing collection dates show an explicit unavailable message. Product
Sales similarly blocks CSV export while selected filters and loaded data differ,
preventing an old report being saved under new filter/date names. Calculations and
payment decisions remain the server's existing workflow.

Management audit history loads on its own History tab instead of on every store
search/page. The Admin dashboard uses its existing refreshKey for NeedsAttention
instead of also registering the child's duplicate live-event listeners. Employee
behavior is retained. Polling/listeners already had cleanup and were reviewed.

### Interaction and lifecycle changes

- The collapsed Admin rail inserted group headings on hover, shifting the item
  under the pointer. The first All Products click reproducibly opened Product
  Creation in both baseline and pre-fix builds. Admin now reserves heading space;
  expanded layout and styling are retained. Other panel rail behavior is unchanged.
- Employee permission drafts initialize/reset during the owning render, preserving
  the existing cancellation behavior while removing the extra effect update.
- Command-palette selection remains bounded after filtering and resets on reopening.
  Drawer closure is derived from the active route, avoiding a redundant effect.
- The two existing product image preview hooks were consolidated: URLs allocate
  after subscription and release on replacement/unmount. This preserves existing
  cleanup and resolves effect-driven-state lint errors; it is not claimed as a
  newly discovered baseline URL leak. Product detail reads reset when IDs change.
- Login fields, permission switches, product/target inputs, cancellation reason
  and notification inputs received accessible names. ConfirmDialog has associated
  title/description IDs. Existing visual styles are retained.

### Frontend security

- Admin route/login guards validate readable ADMIN/expiry claims for navigation,
  respond to expiry and cross-tab token changes, and avoid malformed/expired-token
  redirect loops. Login locks duplicate submissions and rejects unusable tokens.
- Requests capture the Admin token they belong to. A late 401 only clears the
  matching current Admin session, without clearing another panel or a newer token.
- Admin diagnostics retain context/status/safe error codes and exclude Axios
  headers, submitted bodies, raw messages and credential objects.
- Uploaded identity document links allow only HTTP(S); executable schemes cannot
  become links. Existing rich-description sanitization and CSV formula protection
  were retained and regression tested.
- The lockfile updates dev-only Zod from 4.1.13 to 4.6.7 within the supported major.
  Playwright is the only added dependency and is development-only.

Frontend claims checks **do not verify JWT signatures or grant authorization**.
Every backend endpoint must independently authenticate and authorize the caller.
Browser regressions use mocked responses and cannot establish live server access
control, financial reconciliation, database correctness or external integration
availability.

## Remaining concerns and release constraints

- Tokens remain in localStorage to preserve the current authentication contract.
  XSS in any same-origin application can access them. Moving to HttpOnly cookies
  requires a separately planned backend/CSRF/session migration.
- Public identity-document URLs remain a backend/storage concern documented in
  [the backend security review](../../../BackEnd/docs/SECURITY_REVIEW_2026-10-26.md).
  Restricting frontend link protocols does not make stored files private.
- Several endpoints still return complete collections. Pagination bounds rendered
  rows, but server pagination/filtering and production API latency need separate
  backend work if data grows. No endpoints were changed here.
- Production dependency audit reports zero known advisories. Full audit retains
  three moderate dev dependency entries for the Tailwind 3/PostCSS selector parser
  chain, representing the same parser issue. Its patched parser is 7.1.6; npm's
  suggested Tailwind 4 migration is a major styling change outside this scope.
  Ordinary trusted-source build use is outside the described untrusted-selector
  request-path exposure. See [the parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
  The patched Zod advisory is [documented here](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Repository-wide lint started with 21 errors/2 warnings and now has 13 errors/2
  warnings, all remaining in pre-existing Employee/profile/access-sync/marketing
  hub code outside the requested scope. Admin and changed shared code lint cleanly;
  no rules were suppressed. Do not describe whole-frontend lint as passing.
- Cross-browser/device/field checks and real backend integrations have the limits
  recorded with the final test and measurement results. No production mutations
  were performed. Keep this release frontend-only; do not restart backend services
  or include unrelated staged mobile changes in a commit/deployment.

## Validation and measurements

Chrome production-bundle regressions: **57 passed**; Edge production-build
regressions: **57 passed**. Three focused development-build checks with React
Strict Mode also pass (cash races, geo selection, image URL cleanup). Offline unit
regressions: **8 passed**. `npm run lint:admin` passes with zero warnings/errors; full-project
lint has the pre-existing out-of-scope failures described above. `npm run build`
passes both Vite production compilation and public-page prerender. Type checking
is not configured for this JavaScript frontend. Executed check summaries are in
[validation.json](validation.json).

The suite covers all 14 top-level sections plus nested Agent, Delivery, Employee
and Target tabs, session rejection/expiry/401/cross-tab logout, navigation,
financial confirmations and payloads, report races, product edit/delete/previews,
store retention confirmation, dispatch, returns, server errors/retry and lazy
chunk recovery. Happy-path section checks assert no console warnings/errors,
unhandled page errors or missing API fixtures. Expected negative cases deliberately
return errors. Unknown mutation requests fail the fixture instead of receiving a
generic fake success.

### Cold-load measurements

Medians of three fresh Chrome contexts per route, **4x CPU throttling**, 60 ms
network latency and 200,000 B/s download; 40 ms synthetic API delay; 1,000 stores,
2,000 orders, 120 agents and 80 products. Browser: Chrome 156.0.8078.47; Node
22.14.0. Both builds use the same offline font fallback. The before build was
frozen before implementation. The initial payment readiness selector was found
to match its search box before data loaded, so both builds were remeasured using
loaded store data. Uncorrected timing samples are not used below.

| Route | Ready before → after | LCP before → after | Encoded JS before → after |
| --- | --- | --- | --- |
| Login | 2.03 → 2.04 s | 2.03 → 2.03 s | 179,631 → 181,532 B |
| Dashboard | 4.22 → 3.85 s | 4.19 → 3.53 s | 469,860 → 352,488 B (25.0% less) |
| Orders | 4.58 → 3.40 s | 4.41 → 3.41 s | 469,860 → 254,780 B (45.8% less) |
| Payment Info | 4.67 → 3.22 s | 4.04 → 2.74 s | 469,860 → 247,947 B (47.2% less) |
| Product Sales | 4.67 → 3.95 s | 4.66 → 3.93 s | 469,860 → 345,410 B (26.5% less) |

The route byte savings are measured downloads, not a claim that the shared entry
file shrank. That file grew from 537.91 to 542.40 kB minified (gzip 175.74 to
177.60 kB) with the shared session/request safeguards. Login is effectively
unchanged and downloads about 1.9 kB extra. Initial API request counts remain
0/2/2/3/2 respectively; no reduction is claimed.

CLS is unchanged: 0 for login/dashboard/Product Sales, 0.07946 for Orders and
0.0001794 for Payment Info. Median long-task counts are 2→2, 6→6, 7→6, 7→7 and
5→4 respectively. Median summed long-task duration is 310→310, 958→978,
781→694, 785→746 and 1268→1161 ms. These are small samples, not statistical proof
that every rendering path improved.

### Navigation and interaction tradeoffs

First in-app visits after Dashboard versus a repeated sequence with code cached:

| Destination | First visit before → after | Cached visit before → after |
| --- | --- | --- |
| Orders | 1,087 → 1,235 ms | 607 → 579 ms |
| Payment Info | 1,021 → 972 ms | 550 → 573 ms |
| Product Sales | 606 → 927 ms | 402 → 448 ms |

The first Orders/Product Sales visit pays for deferred code (16,939 and 7,190 B
respectively in this navigation sequence). This is the measured tradeoff for a
smaller initial load. Subsequent visits need no extra JS in this sequence. The
23–46 ms cached differences and small search differences are retained in the
results; no universal navigation/responsiveness improvement is claimed.

For Orders and Payment search, median per-run maximum observed Event Timing
entries were 40→48 ms and 72→80 ms. The harness records only qualifying entries
and a scripted typing sequence. Search wall times include intentional key delays
and automation overhead (586→613 ms and 921→942 ms), so they are not pure render
latency. Other cold routes have no qualifying scripted interaction in this run.
**This is not field INP, field Core Web Vitals or a Lighthouse score.** No RUM
instrumentation was added across unrelated applications. Production API latency,
real account data, actual phones and non-Chromium browsers still need field or
staging validation.

Raw evidence: [cold before](cold-before.json), [cold after](cold-after.json),
[navigation before](navigation-before.json), [navigation after](navigation-after.json),
and [median summary](measurements.json). Reproduce with `scripts/measure-admin.mjs`,
`scripts/measure-admin-navigation.mjs` and `scripts/summarize-admin.mjs` against
separate loopback servers for the two frozen builds. These tools use fixtures and
never proxy production APIs.

Visual checks captured Dashboard, Orders and Product Sales at 390, 768 and 1440 px
with no document overflow, plus desktop Cash Verification in dark mode. Expanded
desktop Orders and Product Sales PNGs are byte-identical to the baseline; dashboard
chart animation timing varies. Reviewed screenshots remain in the ignored local
`visual/` artifact folder. No redesign was introduced.

### Release recommendation

Use a frontend-only staged release after a staging smoke with real backend
authorization and representative records. Keep a rollback copy of the current
website assets, include lazy chunks atomically with their matching HTML, and
verify existing open tabs recover from old chunk URLs. Preserve the pre-existing
Product Sales work and unrelated staged mobile changes when selecting a commit.
Monitor authentication, read failures/timeouts and the financial workflows after
release. Recheck dependencies at release time. This audit does not authorize or
claim a backend change, production-data test, push or deployment.

## Source and workflow review map

Paths below are under `src/pages/Admin/`. Files listed together were reviewed as
one workflow, including request ownership, state updates, rendering, calculations,
mutation confirmation, permissions and error/empty states. A route smoke is not
represented as exhaustive verification of every business rule.

| Area / source modules | Review and regression coverage |
| --- | --- |
| `AdminBase.jsx` | Session-scoped logout, navigation and existing live-event subscription/cleanup. Shared theme, permissions, SSE, pagination, images and CSV helpers inspected. |
| `Tabs/AdminDashboard/{AdminDashboard,NeedsAttention}.jsx` | Summary/charts, period switching, API failure/retry, visibility/poll/live refresh; server figures preserved. |
| `Tabs/Agent/Agent.jsx`, `tabs/{AgentManagement,AgentPerformance,AgentIncentives}.jsx` | Tab splitting, latest reads, approval confirmation, incentive totals/payout payload, document protocols, empty performance. |
| `Tabs/Agent/AgentAdministration.jsx` | Store directory/debounce/pagination, access and transfer/destructive preview flow, request IDs, server retention blockers, typed archive confirmation and audit reads. Permanent purge remains server-controlled; no real deletion executed. |
| `Tabs/EmpCreation/EmpCreation.jsx` | Create/list, image handling, permission names/keys, draft cancellation/reopen/save and deactivation confirmation. |
| `Tabs/AssignLocation/AssignLocation.jsx` | Existing coverage replacement, manual pincode input, tier validation, geo lookup cancellation, slow earlier-agent race and timeout behavior. Pricing rules retained. |
| `Tabs/Orders/{OrderManagement,OrderStoreSidebar}.jsx`, `OrderStoreSidebar.css` | Existing indexed/deferred paginated store search retained; 1,000-store search at phone/tablet/desktop, detail expansion, confirmation/cancellation validation/payloads, invoice and CSV downloads. |
| `Tabs/Returns/ReturnManagement.jsx` | Store enrichment, search/status/pagination, details/reason/refund figures, existing read-only timeline. |
| `Tabs/PaymentInfo/{PaymentInfo,PaymentIssues}.jsx` | Payment summary grouping, monetary calculations, pagination, exception panel/settlement confirmation and latest reads. No payment processing logic changed. |
| `Tabs/CashVerification/CashVerification.jsx` | Filter races, stale-row actions, missing dates, single approve/reject and bulk approve, required rejection reason and request contracts. |
| `Tabs/Delivery/Delivery.jsx`, `tabs/{DeliveryManagement,DeliveryApproval,DeliveryAlerts}.jsx`, `DeliveryTrail.jsx`, `deliveryFormat.js` | Independent tabs; order/pickup assignment and reassign confirmation, approval flow, alerts/settings guards, readonly trail/location links. Dispatch payload and empty alert/approval routes tested. |
| `Tabs/ProductCreation/ProductCreation.jsx` | Validation, safe file types/size, categories and object URL replacement/unmount. Existing multipart creation fields retained. |
| `Tabs/AllProducts/{AllProducts,ProductDetails,EditProductDetails}.jsx` | Search/filter/pagination, details/read retry, rich-text safety, edit sends changed fields only (avoids overwriting concurrent stock), delete confirmation and refetch. |
| `Tabs/Targets/Targets.jsx`, `tabs/{CreateTarget,TargetPerformance,SalesTargets}.jsx` | Independent tabs, list/latest reads, activity target validation/create payload, empty performance, monthly settings save and calendar preview. |
| `Tabs/Targets/targetMeta.js`, `sales/{salesTargetMath.js,SalesTargetDialog.jsx,SalesTargetHistory.jsx}` | Duration/rounding/working-day rules and history guards inspected and preserved. Calendar, leap year, fixed working days and weekly sum arithmetic tested. |
| `Tabs/ProductSales/ProductSales.jsx` | Daily/weekly/monthly grouping, report filters, obsolete replies, export synchronization, existing agent drilldown/Back URL behavior and business-vs-agent table. |
| `Tabs/CustomNotification/CustomNotification.jsx` | Audience/history read ownership, input length/required checks, plain-text preview and explicit send confirmation/payload. |

Modified shared files are `api/{services,axiosInstance}.js`, Admin route config and
area, `ProtectedRoute`, `PublicRoute`, `AdminLogin`, `components/layout/` and
`ConfirmDialog`. The new session/request/preview helpers and section boundary are
listed in the inventory. Non-Admin token selection and role contracts were
retained. `PanelNav`'s positional fix is explicitly scoped to `/admin`. Some Admin
screens and shared layout components are also reused by Employee; the full
Employee portal was not browser-tested here. No Employee source files were edited.
