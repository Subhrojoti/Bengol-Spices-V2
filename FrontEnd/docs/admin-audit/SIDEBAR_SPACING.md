# Admin collapsed-sidebar spacing - 29 October 2026

Status: implemented and checked locally; not committed, pushed or deployed.

The owner reported uneven gaps in the unpinned Admin rail. `PanelNav.jsx`
reserved full heading rows while hiding their text, producing 77.75px steps
between groups versus 46px within groups. Invisible item labels also occupied
flex space, placing icon centers at x=26 instead of the rail's x=35.5 center.

Admin's collapsed rail now omits group-heading space and hidden label boxes,
with consistent 46px navigation steps and centered icons, including Logout.
Explicit accessible names remain available for icon-only destinations.
`PanelLayout.jsx` allows headings when pinned or in the mobile drawer. Hover
expansion keeps the compact row positions and reveals destination labels;
inserting headings there would move a different destination under the pointer.
Pinned and mobile retain the original grouped design. Employee layout rules
and backend/navigation destinations are unchanged.

Validation: Admin/shared lint and isolated SPA build pass. Local synthetic
light/dark browser measurements confirm every navigation step is 46px and all
15 icon centers are x=35.5. Hover keeps row positions unchanged; clicking the
original Agent icon coordinates opens Agent. Pin/unpin restores the appropriate
heading layout, and the mobile drawer navigates to Orders and closes normally.
The existing Employee landing/reload/navigation browser case passes. Dark
collapsed and light pinned screenshots were visually reviewed; previews are at
`output/sidebar/`. Unrelated Product Sales/mobile edits and staging are preserved.

Isolated candidate: `FrontEnd/.admin-audit.local/sidebar-release/src/`, based on
`192d5e63c9439733240a6a3f49eda6ba04c6730f`, with only the two shared layout source
files overlaid. No dependency, API, settings or production record was changed.
