# Store registration coverage fix

26 October 2026 (Asia/Calcutta). Implementation complete; production deployment
verification will be recorded below after release.

## Confirmed cause

The installed agent app accepts state as free text. `createStore` uppercased and
trimmed it, then queried AgentSalesLocation by exact state before checking pins.
The screenshot's `WEST BANGAL` therefore failed against the assigned
`WEST BENGAL`, despite pincode `743503` being assigned to that agent. Read-only
production inspection confirmed the assignment and matching deployed controller.
This was deterministic for the submitted text, explaining why other attempts
with different state text could succeed. No outage or missing assignment was
observed in that inspection. Other failures with other messages require their
own diagnosis.

## Changes

- Shared normalization handles case, outer/repeated whitespace, `WEST BANGAL`,
  joined West Bengal names and WB/W.B. It does not fuzzy-match arbitrary states.
- Registration reads only the authenticated agent's assignments, compares
  normalized states and requires an exact six-digit assigned pincode. Neither
  another agent's pins nor another state's pins grant access.
- New stores save canonical state names. Existing assignments with spelling or
  whitespace variants work without a database migration.
- Admin assignment writes use canonical state, trim agent/pin text, deduplicate
  pins and preserve omitted price overrides. Assignment retains its existing
  replace-the-state's-pin-list behavior.
- Catalogue/order location pricing uses the same state normalization, preferring
  a canonical assignment if older spelling variants coexist.
- Errors distinguish invalid pin format, no coverage, mismatched state and
  unassigned pincode, directing agents/admins to Assign Location.

No UI, mobile source, dependencies, schema, indexes, existing customer records or
credentials change. Installed apps receive the backend fix without a rebuild.
State normalization does not verify geographical boundaries or broaden assigned
coverage; existing GPS/duplicate checks remain in place.

## Validation

All 24 backend tests passed against an isolated temporary MongoDB replica set,
without importing server.js/dotenv or connecting to production services. Three
added integration tests exercise successful registration for two agents across
state variants, canonical stored addresses, trimmed assigned pincodes, denied
cross-agent/different-state pins, malformed pins, unknown spelling, missing
coverage, no consumed IDs on refusal, failed-upload cleanup, legacy assignments,
location price preservation, and assignment replacement without price loss.

Production inspection was read-only. No fake store or real payment was created
to test the production fix.
