# Leaderboard release - 25 November 2026

Application commit `d0996d2` was pushed to `origin/main`; its backend was
deployed to the VPS with a graceful `bengol-api` reload. The Agent selector
source is pushed but requires a new mobile build. The website and unrelated
pending Agent/Delivery source were not included in this release.

## Verification

- Before release: 140 backend and 58 Agent tests, TypeScript and Android
  production bundle export passed on the working source.
- The isolated, selectively staged release passed Agent TypeScript, three
  mobile leaderboard tests and seven isolated backend leaderboard tests.
- Staged service configuration checks passed. Production configuration was
  retained byte-for-byte; no credentials are recorded here.
- Read-only controller checks against production data passed before and after
  deployment: 12 active approved agents, incentive and sales ordering, stable
  repeat reads, personalized standing, invalid-metric rejection and independent
  ledger/order aggregation totals. These were direct controller checks, not
  an authenticated mobile-device session.
- All 197 deployed backend files matched the tested release archive. Public
  API health reported a connected database; unauthenticated leaderboard access
  returned 401; Admin login returned 200. The unrelated HR process was unchanged.
- No business records were created, edited or removed by verification. No
  financial recalculation, database migration or new dependency was deployed.

## Rollback

Private release backup: `/root/bengol-release-leaderboard-20261125/api-before.tgz`
(gzip integrity checked). Previous complete code/dependencies:
`/var/www/Bengol-Spices-V2/BackEnd.previous-leaderboard-20261125`.
Restore the previous backend directory at the normal backend path, retain the
current production environment and directory permissions, then gracefully
reload `bengol-api`. No database restore is needed for this code-only release.

Local ignored staging scripts, source archive and verification JSON:
`output/release-leaderboard-20261125/`.
