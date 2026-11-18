# Agent registration address choices — 6 November 2026

Status: **local implementation only**, not pushed/deployed. Preserve the pending
Agent runtime/performance fixes described in `agent-app/docs/AGENT_RUNTIME_REVIEW_2026-11-06.md`.

## Existing behavior checked

Store Type already used selection buttons. State, City and Pincode were free
text in Agent mobile. Admin's existing coverage-read endpoint is permissioned
for office staff; it must not be exposed to Agents or queried with arbitrary
Agent IDs just to populate a form.

## Implementation

- New **GET `/agent/store/my-coverage`**, authenticated and Agent-only. It derives
  identity from the authenticated user and returns only their `state`, `city`
  and `pincodes`. It ignores query-supplied identities. No prices, assignment
  metadata or database IDs are exposed. Responses use `Cache-Control: no-store`.
- Existing office `/locations` permission and all registration authorization
  remain unchanged. No schema/index migration, permissions or existing records
  are modified; the new endpoint is read-only.
- Create Store uses searchable State and Pincode choices from assigned coverage.
  State aliases follow the existing West Bengal normalization; duplicate states,
  cities and pins are merged. Only valid six-digit pins become choices. City
  suggestions are grouped by state, not assumed to be an authoritative postal
  locality list. Agents can explicitly type and use another city.
- A sole assigned state, city or pincode fills automatically only when
  unambiguous. Initial defaults do not overwrite values typed while the request
  loaded. Refreshes do not replace the agent's draft. Changing state resets
  dependent city/pincode values to the new state's unambiguous suggestions or
  blank fields; the street and other typed details are retained.
- If coverage is unavailable (including an older backend), fields fall back to
  their existing manual inputs with a Retry address choices action. Empty
  coverage displays a prompt to ask Admin; registration still independently
  enforces current state/pincode coverage on the server.
- Choice lists are virtualized and searchable; City typing keeps its action
  above the keyboard. No new native dependency, paid service, geocoding or
  third-party location request is introduced.
- Names, phone, street and optional GST remain editable. Store Type buttons,
  request format, photo capture, fresh GPS/50-metre validation, submit/retry
  behavior, Agent Web and Delivery Web are unchanged.

## Verification

- Full backend suite **115/115 passed**, including Agent ownership/query-injection,
  role/auth denial, empty coverage, metadata exclusion and the existing business
  regressions. Tests use disposable MongoDB and mocked external services.
- Combined mobile suites **56/56 passed**. New cases cover state alias grouping,
  PIN isolation, unambiguous defaults, dependent-field clearing, refresh/draft
  preservation, manual fallback, searchable choices and custom city selection.
- Agent typecheck and Android JS/Hermes export passed. No signed AAB/APK built.
- Android Pixel 6/Expo Go against the disposable backend: WEST BENGAL and Kolkata
  filled automatically; searched `743`, selected `743503`, typed and used Behala,
  then confirmed State/City/Pincode remained correct. Inspected menu, keyboard
  and form screenshots. No production account/store change or camera/GPS capture
  was performed in this UI check. Existing development reduced-motion warning
  remained; no new runtime error appeared.
- Source inventory regenerated: **153 modules, 652 relative imports, 187 endpoints**.
  `git diff --check` passed. Evidence remains under `output/store-choices-*`.

Deploy the additive backend endpoint before releasing the new Agent build.
An installed old app retains its current form; an updated app against an old
backend uses manual fallback until this endpoint is available. Delivery and web
clients need no update for this feature.
