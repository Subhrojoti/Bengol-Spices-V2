# Production release: Admin store-photo preview

Released and verified: **26 October 2026 (Asia/Calcutta)**.
Application commit: `9d4754eedb023ac4123edf1af8f35b73887ae0ec`, pushed to GitHub main.

Clicking a store photo opens its original image in a responsive modal in Admin
Orders, Returns, Payment Info and Delivery. Close with Escape, the X or backdrop.
The photo control does not select/expand its store card. Missing photos retain
the initials fallback; failed originals show a dismissible, retryable error.

## Release checks

- Isolated source contained only the 13 task files over the previous committed
  release. Unrelated Product Sales/mobile working edits and staging were preserved.
- Admin lint and full production build/public-page prerendering passed.
- All **71 Chrome browser cases passed** against the isolated build, including
  seven photo cases and existing order/payment/return/dispatch/reporting checks.
  These regressions used synthetic data/intercepted APIs, not real mutations.
- The isolated task sources matched the application commit after text
  line-ending normalization. All **205 deployed website files** matched the
  tested build by SHA-256.

## Deployment and recovery

Frontend only, through `deploy/push.sh frontend`. No backend reload, database
migration, dependency change or nginx update occurred. PM2 `bengol-api` retained
PID 72962/restart count 4; `bengol-hr-api` retained PID 49306/restart count 0.
The upload retained 142 previous JS/CSS files for open tabs. Refresh the Admin
panel to load the new photo control.

Protected pre-release rollback files:

- Website: `/root/bengol-backups/website-store-photo-20261026-145737.tgz`.
- Matching asset manifest:
  `/root/bengol-backups/website-store-photo-20261026-145737.build-assets`.

If rollback is needed, restore the website and matching `dist.build-assets`
manifest together. The previous release already supports the current Admin
cookie sessions; no session or business-data rollback is required for this UI.

## Live verification

A fresh Chrome browser signed in on the real Admin host and opened an existing
store's photo in Orders. The full image loaded, store selection stayed unchanged,
Escape closed it, and the modal fitted a 390px phone viewport and closed using
the X. Logout passed; no page runtime errors occurred. No images, credentials,
customer responses or browser traces were saved. Only reads and login/logout
POST requests were allowed during this smoke test.

API HTTPS/database health, public catalogue, home/about, agent/admin/employee
login pages, robots/sitemap, HTTP/2 and expected redirects/404 all passed after
deployment. No live store, order, payment, return, incentive or agent mutation
was performed. Photo previews in the other three Admin sections were covered by
the isolated browser suite; live image verification was in Orders.
