# Admin responsiveness and layout — 1 November 2026

Owner request: optimize the Admin Panel for smooth use, correct design issues,
and preserve working production workflows. This is local work only. No push,
deployment, backend startup or production data operation was performed.

## Findings and changes

The existing Admin implementation already splits routes/tabs, paginates most
lists, requests bounded order pages, defers indexed store search and cancels
obsolete reads. Those mechanisms were retained. This pass addresses measured
rendering costs rather than adding blanket memoization or a persistent cache.

Agent Performance paginated its table but rendered every agent in its chart.
With 200 synthetic agents this produced 1,446 main-content elements, a 10,460px
page and repeated chart animation work. The chart now uses the existing
10/25/50-row pagination controls independently of the table. Small reports retain
their existing appearance. All-agent totals and ranking still use the complete
response. The numeric chart axis uses the full report's range across pages, so
moving between ranks does not rescale bars misleadingly. Decorative bar animation
is disabled to avoid repeated animation work during paging and live refresh.

Delivery Performance rendered every partner's full report card at once. With
120 partners this produced 4,616 main-content elements and a 36,050px page. It now
uses the existing pager, defaulting to ten cards. Changing report filters resets
the page, refreshing retains it, and all partner details/collection history remain
accessible. No per-partner calculations, date filters or API payloads changed.

Mobile visual review found clipped captions in Payment Info and Cash Verification,
plus a narrow payment search field. Captions now wrap and the search occupies its
own full-width row on narrow screens. The existing icon-only Export/Refresh
buttons retain accessible names. Desktop layout and the current visual theme
remain in use.

Phone paging also exposed an existing `scrollIntoView` limitation: it could move
the outer document, hide its header and position the next page under sticky tabs.
`usePagination` now has an opt-in `panelScroll` option. The two performance reports
(including the agent table) use it to scroll only their nearest `main` container,
with clearance measured from the actual sticky tab bar. Other callers retain the
previous default behavior. No global scroll listener was introduced.

## Measurements and verification

The repeatable script is `scripts/measure-admin-smoothness.mjs`. It compares
loopback-served production SPA builds using intercepted synthetic APIs: 200
agents, 120 delivery partners, 2,000 orders and 1,000 stores. Installed headless
Chrome is throttled to 4x CPU, with three fresh contexts per report. It records
load-to-content readiness, main-content/SVG element counts, page height, long
main-thread tasks, and a Payment Info search control case. These are laboratory
measurements, not production response times, FPS, field INP or guarantees for all
devices. Payment search was not rewritten and no search-speed gain is claimed.

Final medians are saved in
[the measurement summary](SMOOTHNESS_MEASUREMENTS_2026-11-01.json).

| Large synthetic report | Before | Final | Change |
| --- | ---: | ---: | ---: |
| Agent load-to-content ready | 2,278ms | 1,683ms | 26% faster |
| Agent long-task time | 1,867ms | 712ms | 62% less |
| Agent main-content elements | 1,446 | 333 | 77% fewer |
| Delivery load-to-content ready | 1,873ms | 1,526ms | 19% faster |
| Delivery main-content elements | 4,616 | 463 | 90% fewer |

Payment Info search was a control: 954ms before versus 998ms after for the full
typed phrase, including the scripted inter-key delay. That variation is not
evidence of a search improvement or a measured production regression; its search
algorithm was retained. No broad claim about every Admin screen's speed is made.

Full inputs/logs/build snapshots and screenshots are ignored local evidence under
`FrontEnd/.admin-audit.local/smoothness-2026-11-01/`. The frozen `before-dist`
contains the prior task's tested build. Final checks use a fresh server because
the audit server deliberately caches served assets in memory.

Four new browser cases cover large reports at 390px and 1440px: bounded chart/card
counts, original totals, later ranks, independent chart/table pages, partner
history, refresh/filter semantics, sticky-tab clearance and outer-document scroll
position. They pass on the final build. Mobile screenshots of Agent Performance,
Delivery Performance, Payment Info, Cash Verification and Product Sales were
inspected before/after; payment captions/search no longer clip. Dark report paging
was inspected and corrected as described above.

The fresh final full Admin/Employee browser suite passes **125/125** (3.6 minutes),
including all four new cases and existing order, invoice, payment verification,
targets/incentives, reporting, permissions, session, cleanup and responsive checks.
Admin lint, the changed pagination hook/measurement script lint, the SPA build,
12 frontend unit tests and `git diff --check` pass. The pre-existing large-bundle
build warning remains. One intermediate browser run overlapped a rebuild and its
last four cases loaded obsolete assets; that run is not accepted as final
evidence. `browser-clean-final.log` records the successful fresh complete run.

## Scope and continuation

Affected product files are the two performance reports, Payment Info and Cash
Verification presentation, and the opt-in pagination helper. No new packages,
backend/API changes, agent/delivery portals or mobile changes were introduced.
Existing unrelated working-tree edits and the staged mobile screen rename are
preserved. Browser API fixtures verify frontend behavior and request contracts;
they do not certify live balances or backend authorization. Deployment remains a
separate step.
