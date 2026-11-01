# Orders filter alignment

1 November 2026. Local styling fix only; no deployment.

Date basis and Period were stacked inside a single grid item. That made the row
taller and stretched the Agent/Store lookup wrappers. Their absolutely positioned
menus used the stretched wrapper's bottom, leaving a gap below the trigger.

The controls are now separate grid items. Wide screens fit them in one row;
smaller desktop/tablet widths wrap into balanced rows, and phones stack them.
Search/select/lookup controls share a 40px height, native fields use block layout
to avoid baseline gaps, and the search icon is centred. Clear filters aligns to
the control baseline; custom date inputs occupy a separate full-width row.
Lookup wrappers align to their own content so menus stay below their triggers.

Existing labels, URL state, search/status/date semantics, API requests, pagination,
exports and order actions are unchanged. No backend/mobile/Agent Web/Delivery Web
changes. Existing local work and staging are preserved.

Validation: component lint, SPA build and all 12 existing Orders browser checks
pass, including dropdown selection, custom dates, CSV, actions and layouts at
390/768/1440px plus dark desktop. The 1600px dark screenshot was visually checked.
Evidence: order-filter-alignment-build.log and order-filter-alignment-browser.log
under ignored FrontEnd/.admin-audit.local/ecosystem-upgrade/. Existing responsive
screenshots are under FrontEnd/.admin-audit.local/.
