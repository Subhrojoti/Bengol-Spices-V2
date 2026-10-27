# Employee header crash — 27 October 2026

Status: **pushed, deployed and verified**, application commit `d646056`.
See [production evidence](../../../deploy/releases/2026-10-27-employee-header-fix.md).

Employee login successfully obtained its session, but rendering the shared header
threw `ReferenceError: UserRound is not defined`. The profile-menu icon remained
in JSX after its import was mistakenly removed in the earlier Admin audit
(`ea08a37`). Employee supplies `profilePath`, so it renders that branch; Admin
does not, explaining why Admin-only browser checks missed it. The app's outer
error boundary displayed the photographed Ooops page even at bare `/employee`.

Restored the missing import. No route, login API, permission key, employee account
or business logic was changed. Added a local ESLint JSX-name rule because core
`no-undef` does not validate JSX component identifiers. It checks actual lexical
bindings, including component-member roots, and requires no new dependency. A
lint probe containing an undefined JSX icon is rejected by the rule.

The bare-Employee regression was observed failing before the import fix. Three
new browser cases now pass with synthetic employee data/intercepted APIs: login
to Dashboard and the Profile menu; bare landing/reload and permitted Orders with
pinned navigation; and unchanged restriction of an ungranted Dashboard route.
Initial test selectors were adjusted to the existing form input names and pinned
navigation; no unrelated Employee login or navigation source was changed.

Existing mobile/Product Sales working edits remain out of scope. The isolated
release excludes them. Full Admin/Employee browser checks, frontend build and
live-host validation are recorded in the release evidence: all 74 Chrome cases,
targeted lint, complete build/prerender and 205 deployed file hashes passed.
The before/after live-host frontend probes used synthetic intercepted Employee
APIs and reproduced/removed the exact missing-icon crash without using any real
employee password. Backend processes and permissions were unchanged. An existing
error tab needs Reload Page or Ctrl+Shift+R to fetch the corrected JavaScript.
