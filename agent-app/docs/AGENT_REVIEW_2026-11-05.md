# Agent mobile bug and performance review

Date: 5 November 2026. Local follow-up to item returns and optional advances.
No push, production deployment, signed build or app-store submission performed.

## Scope and findings

Reviewed the Agent navigation, authentication/API handling, store list/map and
registration, product selection/placement, order history/details/editing,
collections/invoice download, return lifecycle and the shared refresh/query
hooks. Existing permissions, backend validation, financial rules and visual
design are retained. This follow-up changes Agent mobile source only, plus
tests/documentation. Earlier pending backend/Admin/Delivery changes are preserved.

### Order-history crash and unnecessary CPU work

The store history grouped dates using `toISOString()` without checking validity.
A malformed legacy creation date caused a RangeError and blanked the history.
Invalid/missing dates now remain visible in a Date not recorded section, after
dated sections. India month boundaries are retained. Equal timestamps sort
deterministically by order ID. Search, filters, totals and collapsed sections
still include the same records and preserve payment-verification distinctions.

Grouping formerly rebuilt a growing month array for every order. It now appends
to local buckets and sorts each once, without modifying the source/cache array.
Month keys are prepared once per data refresh. Date/product search text is built
only when a search starts and reused for subsequent keystrokes; ordinary opening
does not eagerly format every date for an unused search index.

Local Node CPU measurements, seven runs with two warmups and the remaining
median, on 10,000 synthetic same-month orders:

| Work measured | Before | After |
| --- | ---: | ---: |
| Month grouping/sorting | 124.8 ms | 8.4 ms |
| Initial data preparation/grouping | 180.3 ms | 58.8 ms |
| Five typed search prefixes, including index construction | 985.4 ms | 105.0 ms |

These are local data-processing measurements, not native rendering frame rates
or live production timings. Evidence is in ignored
`output/agent-review-history-benchmark.json` and
`output/agent-review-history-pipeline-benchmark.json`.

### Item-return retry recovery

The new item form previously kept its reference only in a component ref. A
return committed with a lost response could be submitted again under a fresh
reference after leaving the screen/restarting, reserving additional goods.

The Agent now saves the exact reference, reason and selected lines in existing
encrypted SecureStore **before** sending. Storage is scoped to the Agent's
database ID and order, with an owner/order/version/content check when read.
Unreadable or corrupt recovery data blocks a fresh submission and offers retry
rather than silently discarding the original reference. Restored inputs are
locked while Retry Same Return reconciles the original request. Storage is
cleared after successful acknowledgement or a definitive server rejection;
uncertain replies, including lock admission conflicts, retain it. Failure to
clear storage also retains recovery instead of allowing another new request.
Late responses from an unmounted/changed form do not update another screen.

Server idempotency and quantity reservations remain authoritative; no return,
payment, invoice, balance or inventory rules were changed here. Delivery mobile
source is not modified in this Agent-only review.

### Order editing

A background refresh with updated stock could replace unsaved quantities. The
editor now initializes per order/revision, retaining the draft when that same
revision refreshes. An externally changed revision reloads the latest details
with an explicit review message. The existing expected-revision/total checks
still protect saving on the server.

Older orders may contain more than one line for the same product. The editor
previously retained only the last line's quantity. It now sums those quantities,
matching the backend's per-product reservation/editing model. Products with no
ID retain the previous unavailable-product handling. Historical order/invoice
records are not rewritten by opening the editor.

### Catalogue and invoice download

- Hidden product pickers no longer fetch a catalogue. Stock-bearing catalogue
  data expires after 30 seconds instead of ten minutes, and successful Cash,
  Online or QR placement invalidates it. The next product selection reads
  current availability. Backend stock checks remain the final authority; this
  does not promise real-time stock reservations on the phone.
- Invoice downloads use a synchronous in-flight guard so rapid repeated taps
  cannot start overlapping downloads/share sheets in that screen. A missing
  token is refused locally; a download from an older login is not shared after
  a session change. HTTP 409 now explains temporary invoice unavailability/
  confirmation rather than displaying native downloader implementation text.
- Corrected a stray question-mark separator in the new return-item summary.

## Validation

- Combined mobile offline regressions: **21/21 pass**, including six new Agent
  cases for safe history grouping, duplicate-line initialization and validated
  return recovery. Tests cover malformed dates, India month boundaries,
  deterministic ties, large-history identity/amount preservation, corrupt
  recovery records and owner/order mismatch refusal.
- Agent TypeScript check passes. Final Android production JavaScript/Hermes
  export passes at `output/agent-review-release-android-2026-11-05`; this is not
  a signed binary. Logs: `output/agent-review-tests.log`,
  `output/agent-review-typecheck.log`, `output/agent-review-release-export.log`.
- `git diff --check` passes. Native Metro logs contain no app TypeError,
  RangeError or runtime ERROR; the existing development-only reduced-motion
  warning appeared on the emulator.

Backend behavior is unchanged in this follow-up, so the preceding 113-test
backend pass remains the baseline; it is not represented as a new backend run.

Native checks used the installed Pixel 6 emulator, Expo Go 56 and the actual
backend against a disposable replica set, fake accounts and disabled external
services:

- Seeded a malformed creation-date string. Store history opened with all three
  orders and unchanged totals, and retained an undated section. Order details
  also displayed Date not recorded.
- Deliberately dropped the first return HTTP response **after** its transaction
  committed. The form showed an uncertain-response prompt. Force-stopped and
  relaunched Expo Go; the form restored its saved line/quantity/reason, kept
  editing disabled and offered Retry Same Return. Retrying preserved exactly
  one return with the same reference/return ID and unchanged due balance.
- An older draft with two five-unit lines for the same product initially showed
  ten units. Typed an unsaved quantity of 15, backgrounded the app, changed only
  fixture stock and resumed. Availability refreshed from 10010 to 10009 while
  the unsaved quantity stayed 15. No edit was saved in this check.
- Native screenshots were inspected for history, recovery and editing. Synthetic
  evidence lives under ignored `output/agent-review-*`; no production records,
  login credentials, identity images or actual payment data are included.

These checks use Expo Go, not a signed release binary or a physical device. No
live UPI/card transaction or native file-share to another person was performed.
The invoice guard/session checks were reviewed and compiled; no external share
was sent. A final signed-release smoke check remains appropriate before rollout.

## Release compatibility

This follow-up adds no package/native-module dependency and changes no API
format or web client. A new Agent build is required for these fixes. The earlier
pending item-return and zero-advance backend endpoints must be deployed before
shipping the mobile build that includes those new forms. Documentation in
`BackEnd/docs/ITEM_RETURNS_ADVANCES_2026-11-05.md` remains the feature/release guide.
