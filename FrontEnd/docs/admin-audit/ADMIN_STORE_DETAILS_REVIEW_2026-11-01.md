# Admin follow-up: Store Details and security

1 November 2026. Local changes only; no deployment, production writes or backend
startup. The owner identified Store Details as the slow page. Existing dirty
ecosystem changes and the staged mobile-file rename were preserved.

## Findings and changes

- Store Details already has backend pagination (25 records). No duplicate paging
  system was added. Removed the 250ms typing delay from initial loading, paging,
  filter selection and refresh. Search text still debounces and superseded reads
  are cancelled.
- Search previously unmounted all cards immediately, collapsing the scrollable
  area. Cards now retain their space while loading, with an explicit busy state
  and `inert` to prevent stale orders/code/photo actions. Revealed codes are cleared
  when filters change. Errors still clear obsolete data.
- A whitespace-only search change could set loading forever without triggering
  a request, because the request trims whitespace. Loading now compares the same
  normalized query as the request effect.
- Reuse one India-time date formatter rather than constructing locale formatting
  machinery for every card on every keystroke; missing/invalid dates show
  “Not recorded.”
- Store-report avatars use the existing bounded Cloudinary thumbnail helper.
  Signed/custom/transformed URLs remain unchanged; failed thumbnails fall back
  to originals, and the photo dialog always opens the original asset.
- Paging returns to the report below the sticky tabs. Long store-order link labels
  wrap within the card. Target navigation now wraps within narrow viewports;
  Delivery summary captions no longer truncate their meaning on phones.

## Security review

- Examined Admin auth/request lifecycle, rich-text rendering, external links,
  report export escaping, store-report access and destructive-operation routes.
  Existing HttpOnly Admin sessions, stale-session response guards, sanitized
  product descriptions and safe external document links remain in place.
- CSV export now also guards leading LF and full-width formula initiators. Numeric
  cells remain numeric; existing escaping/quoting is unchanged. This follows the
  character cases described by [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).
  Spreadsheet import/re-save behavior varies; this is not a guarantee against
  arbitrary downstream transformations of an exported file.
- Updated only `follow-redirects` 1.16.1 to 1.16.2 in the frontend lockfile, without
  install scripts or unrelated upgrades. The [upstream advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
  concerns Node redirect handling, not a demonstrated browser Admin exploit.
- After the patch, npm reports zero high/critical findings and six moderate
  findings, all from the development ESLint/minimatch chain. The [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
  lists a fix in 11.0.1; installed ESLint uses the v3 API. A forced cross-major
  override would be unsafe. This toolchain dependency is not shipped in the SPA;
  no user-submitted glob patterns are evaluated by the Admin frontend. Reassess
  when a compatible upstream linter update is available.
- Backend routes independently protect store reports and code reveals with
  `protect` and dedicated `checkPermission` checks; dispatch mappings and Admin
  workspace/destructive operations retain Admin checks. Frontend checks are not
  represented as authorization enforcement or proof of live server configuration.
- Previously documented public identity-document storage remains unresolved by
  frontend changes; see [backend security follow-up](../../../BackEnd/docs/ADMIN_SESSION_HARDENING.md).
  This review does not certify the entire production system as vulnerability-free.

## Validation and evidence

Browser checks use synthetic intercepted APIs, not production data.
The full suite covers all fourteen top-level Admin sections and regression cases
for orders/invoices, payment verification, targets/incentives, reports, auth,
destructive previews, store navigation/photos, mapping revoke and responsive UI.
This is functional coverage, not a claim of exhaustive performance profiling of
every nested screen or live backend penetration testing.

Benchmark: `scripts/measure-store-details.mjs`; three cold local Chrome contexts,
4x CPU throttling, 1,000 synthetic stores (25/page), 40ms report latency. Raw files
are in `.admin-audit.local/admin-full-review-2026-11-01/`. Timing excludes real
image delivery and production database/network latency.

Three-run medians: initial Store Details readiness **2,008ms → 1,590ms (21%)**;
Next-page interaction **988ms → 461ms (53%)**. Search retains 25 cards instead of
collapsing to zero during loading. See [raw measurements](STORE_DETAILS_MEASUREMENTS_2026-11-01.json).
These are laboratory measurements, not production FPS or INP figures.

- Full browser suite: **128/128 passed** before the final whitespace-query and
  long-link/caption refinements. **26/26 final affected-flow checks passed** on
  the final build, including whitespace search, pending reveal cancellation,
  retained/inert cards, page scroll, original photos, store-to-orders navigation,
  permission restrictions and existing ecosystem workflows.
- Frontend unit suite: **13/13 passed**, including CSV attack-character coverage.
- Admin lint, additional changed-script/CSV lint, and final SPA build passed.
  The existing initial-bundle size warning remains; it is not a new failure.
- All fourteen top-level Admin pages inspected at 390px in dark mode: no runtime
  errors, missing API fixtures or outer horizontal overflow. Screenshots saved in
  the evidence directory. Nested report/Orders/photo cases also cover desktop and
  mobile sizes. The Targets wrap was inspected in light and dark themes.
- Final Store Details and Delivery mobile screenshots rechecked: no outer
  horizontal overflow, readable dispatch captions and preserved sticky tabs.
  Synthetic raw store rows omit report-enriched agent names in the benchmark
  and one screenshot; this is a fixture limitation, not production data evidence.
