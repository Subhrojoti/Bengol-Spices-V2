# Employee header crash — 27 October 2026

Status: fixed and tested locally; release validation in progress.

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
live-host validation are recorded in the release evidence once completed.
