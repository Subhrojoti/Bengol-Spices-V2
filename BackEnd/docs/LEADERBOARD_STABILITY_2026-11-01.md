# Leaderboard ranking stability

Source review and local fix: 1 November 2026. Not deployed.

The Agent mobile leaderboard and its dashboard standing consume
`GET /agent/leaderboard`; the Agent web leaderboard uses the same endpoint.
Both clients display the server ordering/ranks. No client changes are needed.

The service merged unsorted MongoDB aggregation results, then sorted only by
incentives earned. Equal earnings preserved the aggregation's incidental order,
allowing tied agents to exchange ranks, medals or places in the limited result
between requests without any change to their metrics.

`services/leaderboard.service.js` now sorts by earnings descending, then agent ID
ascending for equal earnings, before applying the limit and assigning ranks.
The existing earnings calculation, eligibility, date window, metrics, medals,
response shape and UI are unchanged. Rankings can still change legitimately as
earnings change or records enter/leave the requested date window.

`tests/leaderboard.test.js` exercises the actual service with model methods
mocked, without connecting to any database. Both regressions failed before the
fix: reversing aggregation rows changed ranks and the tied top-limit selection.
They cover mixed order/return/target/store participants, zero earnings, preserved
metrics, earnings precedence and stable limiting. Full backend suite: 91/91
pass, including both stability regressions. Syntax and scoped whitespace checks
also pass. Other backend integration tests use disposable MongoDB instances;
no production data was accessed or changed.
