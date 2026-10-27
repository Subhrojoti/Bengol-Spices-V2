# Production hotfix: store registration at shared GPS coordinates

Released and verified: **27 October 2026 (Asia/Calcutta)**.
Application commit: `73c6f993fb2998172ba06914fd4e1eb988aaf351`, pushed to GitHub main.
The owner explicitly approved push/deploy after reviewing the tested fix.

## Cause and change

The backend rejected every new store whose latitude/longitude exactly matched
any active or archived store. A reported position is not a unique shop identity.
The screenshot's exact message was reproduced with a different shop, phone and
agent at an existing store's coordinates before the change.

Removed only that query/rejection in `createStore`. Existing trimmed-phone
duplicate checks, GPS validity/India bounds, assigned state/pincode, photo/type
requirements, authentication, ID/code generation, target updates and cleanup
remain. Coordinates are saved unchanged. There is no schema/index/data migration
or app update. No store was deleted or moved to work around this issue.

## Verification and rollout

- All **43 backend tests passed** on isolated MongoDB and mocked services.
  Coverage includes active/archived shared coordinates across agents and retained
  phone, GPS and coverage refusals without consumed IDs or leaked uploads.
- Read-only inspection confirmed the previous runtime matched its expected
  baseline (116 runtime source/config files) and no unique GPS index existed.
- Seven hotfix files were committed with explicit paths. The existing 36
  unrelated Product Sales/mobile working files and staged mobile work were
  preserved. All deployed backend source contents matched the application commit
  after text line-ending normalization; binary assets matched directly.
- Used the existing backend-only deployment flow: credential checks, API/database
  backups, locked dependencies, unchanged private settings, graceful PM2 reload.
  Only `bengol-api` restarted (restart count 4 to 5); the unrelated HR API retained
  PID 49306 and zero restarts. Website/mobile/nginx were not redeployed.
- All **138 backend file hashes** matched deployment. The GPS-only rejection was
  absent and the phone refusal remained in deployed source. Production environment
  values, including authentication secrets, matched their pre-release values.
- HTTPS health/database connection, public catalogue, HTTP/2, public/admin/
  employee/agent pages and expected redirects/404 passed. Admin cookie login,
  dashboard/coverage reads, CSRF refusal and stream/logout revocation passed;
  the smoke-test sign-in was removed normally.

No fake store, real payment, password change or other live business mutation was
used for verification. Source verification plus isolated creation tests establish
the new branch behavior; the employee can retry normal registration at the shop.
The cause of this specific device's equal coordinate reading was not determined.

## Recovery

- API snapshot: `/root/bengol-backups/api-20261027-051839.tgz`.
- Database backup: `/var/backups/bengol-spices/2026-10-27_0518`.

Verify backup availability against current retention before using a recorded
path. Application rollback can restore the API snapshot and reload PM2; no data
rollback is required for this code-only change. Reverting restores the previous
GPS-only rejection and may block the same employee again.
