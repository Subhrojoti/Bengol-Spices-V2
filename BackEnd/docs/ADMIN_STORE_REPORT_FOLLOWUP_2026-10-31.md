# Store report navigation, stacking and dispatch mapping follow-up

31 October 2026. Local changes only; no push/deployment or production mutations.

Owner reported photo overlap with Agent tabs, requested a registering-agent
dropdown with email, store-to-orders navigation, Back controls and delivery
mapping revocation. Existing implementation was inspected first: Orders already
supports store filters, and mappings already support pausing automatic assignment
by unticking the setting and saving. Those capabilities are reused.

## Changes

- Agent's sticky tabs use an opaque page background and higher stacking level;
  the content has a separate lower stacking context. Photo preview buttons no
  longer paint over the tabs while scrolling. Photo modals remain unchanged.
  Owner's subsequent styling correction removes the contrasting bar/capsule
  fill: the sticky wrapper inherits the page colour, and the tab group has no
  background fill. Active-tab highlighting and the overlap protection remain.
  This styling correction passes component lint, the SPA build and both existing
  phone/dark-desktop scrolling checks (agent-tabs-background-*.log in QA evidence).
  On 1 November the owner supplied Delivery's tabs as the desired reference:
  restore the same rounded tab-group fill while keeping the full-width wrapper
  in the inherited page colour. This latest preference supersedes the capsule
  removal above; sticky stacking and active-tab styles remain intact.
- Store Details replaces the free-text ID field with a registering-agent dropdown
  showing name, email and agent ID. A separately permission-checked selector API
  returns only these three fields, including retained historical/inactive agents.
  It does not require or grant access to agent management or identity documents.
- Store name and View orders link open the existing Orders screen for precisely
  that consumerId. Admin uses the existing bounded workspace; Employee uses the
  existing store-order endpoint/UI and can only navigate when permitted to view
  orders. A linked store without orders can still display as an empty selection.
- Back to Store Details restores the registering agent, search, date range,
  status and page through URL parameters. Return URLs are restricted to the same
  panel's Agent Store Details route. Back to agents returns to a permitted Agent
  section; employees with only report access get Back to their Profile instead.
- Agent mapping has a separate Revoke mapping action with confirmation. Existing
  pause/save remains available. Revocation removes only DispatchMapping, records
  the previous mapping and actor in AdminAudit in the same transaction, and never
  modifies assigned orders, delivery history or partner accounts. Subsequent
  confirmation without another active mapping remains unassigned with the existing
  warning. Old partnerId/updatedAt comparisons reject stale revocation requests.
  Missing mappings are harmless repeat successes; an audit failure rolls back.

## API additions

- GET `/agent/store/reports/agents`: Admin or canViewStoreReports; minimal roster.
- DELETE `/admin/dispatch-mappings/:agentId`: Admin only; JSON body contains the
  reviewed mapping's partnerId and updatedAt. Returns 409 if that mapping changed.

No new model/index, migration, credit/payment/target/incentive changes. No mobile,
Agent Web or Delivery Web changes for this follow-up. Preserve the earlier local
ecosystem work and staged registration-screen rename.

## Verification

The later 1 November Orders filter alignment correction is recorded in
[frontend layout notes](../../FrontEnd/docs/admin-audit/ORDERS_FILTER_ALIGNMENT.md).
It changes field/grid/lookup positioning only; no backend behavior changes.

- Backend: **81/81 pass**, including selector permissions/field projection and
  revocation access, stale guard, repeat handling, audit rollback, existing-order
  preservation and later unassigned confirmation.
- Frontend: **12/12 unit tests pass**, Admin lint/new-component lint pass, final
  SPA production build passes. The existing large-bundle warning remains.
- Browser suite: **109/109 full regressions pass**. After normalising the return
  route for direct Employee sidebar entry, **17/17 final affected cases pass**,
  including the added direct-entry/empty-store case (110 distinct cases now exist).
  These cover Admin/Employee navigation/filter restoration, phone/desktop photo
  stacking, report-only Back access and cancel/confirm mapping revocation.
  Both dark desktop and light phone stacking screenshots were visually inspected.
- Evidence: ignored `FrontEnd/.admin-audit.local/ecosystem-upgrade/` files
  backend-followup.log, frontend-followup-unit.log, admin-followup-lint.log,
  admin-followup-build.log, browser-followup-full.log and
  browser-followup-final-navigation.log. Phone/desktop stacking
  screenshots are store-tabs-390.png and store-tabs-1440.png in the same folder.

The broader upgrade's native-device acceptance remains pending, as recorded in
[its validation handoff](ECOSYSTEM_UPGRADE_VALIDATION_2026-10-31.md). This Admin
follow-up does not claim completion of those mobile camera/GPS/WebView checks.
