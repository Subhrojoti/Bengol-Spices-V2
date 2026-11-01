import test from "node:test";
import assert from "node:assert/strict";
import Agent from "../models/Agent.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import Store from "../models/store.js";
import { getLeaderboard } from "../services/leaderboard.service.js";

// Exercise the real merging, ranking and limiting with varying MongoDB group
// output order. No database connection or production services are started.
function fixture(t, groups) {
  for (const [model, key] of [[Order, "orders"], [Return, "returns"], [AgentTargetProgress, "progress"], [Store, "stores"]]) {
    t.mock.method(model, "aggregate", async () => groups[key] || []);
  }
  t.mock.method(Agent, "find", () => ({ select: async () => [] }));
}
const period = { from: "2026-10-01", to: "2026-10-31" };

test("tied leaderboard rankings remain identical when aggregation order changes", async t => {
  const groups = {
    orders: [{ _id: "BS2026-003", sales: 100 }, { _id: "BS2026-001", sales: 20 }],
    returns: [{ _id: "BS2026-005", returns: 1 }],
    progress: [{ _id: "BS2026-004", earnedAmount: 0, completedTargets: 1 }],
    stores: [{ _id: "BS2026-002", storesCreated: 5 }],
  };
  fixture(t, groups);
  const first = await getLeaderboard(period);
  groups.orders.reverse();
  const refreshed = await getLeaderboard(period);
  assert.deepEqual(refreshed, first);
  assert.deepEqual(first.map(row => row.agentId), ["BS2026-001", "BS2026-002", "BS2026-003", "BS2026-004", "BS2026-005"]);
  assert.deepEqual(first.map(row => row.rank), [1, 2, 3, 4, 5]);
  assert.equal(first.find(row => row.agentId === "BS2026-002").storesCreated, 5);
});

test("earnings remain the primary ranking rule with stable ties before the limit", async t => {
  const groups = { progress: [
    { _id: "BS2026-001", earnedAmount: 1 },
    { _id: "BS2026-005", earnedAmount: 100 },
    { _id: "BS2026-004", earnedAmount: 100 },
    { _id: "BS2026-003", earnedAmount: 100.01 },
  ] };
  fixture(t, groups);
  const first = await getLeaderboard({ ...period, limit: 2 });
  groups.progress.reverse();
  assert.deepEqual(await getLeaderboard({ ...period, limit: 2 }), first);
  assert.deepEqual(first.map(row => row.agentId), ["BS2026-003", "BS2026-004"]);
  assert.deepEqual(first.map(row => row.earnedAmount), [100.01, 100]);
});
