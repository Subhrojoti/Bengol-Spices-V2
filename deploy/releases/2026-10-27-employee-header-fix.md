# Production repair: Employee header after login

Released and verified: **27 October 2026 (Asia/Calcutta)**.
Application commit: `d646056e688985d4512b25dc0b56eb913ec20de0`, pushed to GitHub main.

## Incident and correction

Employee's shared header rendered `<UserRound />` in the Profile-menu branch,
but the earlier Admin cleanup (`ea08a37`) had removed its import. This threw a
ReferenceError and the outer error boundary displayed Ooops. Admin did not render
that branch, so the earlier Admin-only browser coverage missed the regression.

The missing icon import was restored. A dependency-free ESLint rule now checks
JSX component bindings, including member roots, because core no-undef did not
catch the undeclared JSX name. A deliberate undefined-icon lint probe is refused.
Employee routes, permissions, account fields and backend authentication were not
changed. No account/password reset or business-data repair was needed.

## Validation

- Reproduced the deployed ReferenceError and Ooops screen in a fresh browser on
  the real Employee host, while intercepting APIs with synthetic employee data.
- All **74 Chrome browser cases passed** against the isolated release: the 71
  existing Admin cases plus three Employee login/menu/profile/reload/permission
  cases. Navigation coverage uses the supported pinned rail mode.
- Targeted Admin/shared lint and complete production build/prerender passed.
  The existing shared entry-size warning remains. Previously recorded unrelated
  full-repository lint findings were not suppressed or claimed resolved.
- The nine isolated release files matched the application commit after text
  line-ending normalization. All **205 deployed website file hashes** matched
  the tested build. No dependency or CSS change was required.
- After deployment, a fresh browser using real deployed frontend assets and
  synthetic intercepted Employee APIs completed login UI, Profile-menu navigation,
  bare `/employee` landing and reload without the missing-icon crash. These are
  frontend regression checks, not a login using a real employee's password.
- API/database health, public/admin/employee/agent pages, expected redirects/404
  and HTTP/2 passed. No live account or business record was modified by testing.

## Deployment and recovery

Frontend only through the existing staged website upload/swap; 141 previous
JS/CSS assets retained for open tabs. The backend remained on the GPS hotfix:
`bengol-api` PID 79713/restart count 5 and HR API PID 49306/restart count 0 were
unchanged. Unrelated Product Sales/mobile working files and staging were preserved.

Protected rollback files:

- `/root/bengol-backups/website-employee-header-20261027-055312.tgz`.
- `/root/bengol-backups/website-employee-header-20261027-055312.build-assets`.

Restore the website and matching asset manifest together if rollback becomes
necessary; the previous build reintroduces the Employee crash. No database or
session rollback is required for this frontend-only change.

An already-open error screen still runs the previous JavaScript. Click **Reload
Page** or use **Ctrl+Shift+R** to load the corrected build. Existing Employee
sessions and assigned permissions are retained.
