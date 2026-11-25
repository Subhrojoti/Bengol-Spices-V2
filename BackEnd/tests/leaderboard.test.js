import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Agent from "../models/Agent.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import Store from "../models/store.js";
import { getLeaderboard, rankLeaderboard, leaderboardRange } from "../services/leaderboard.service.js";
import { leaderboard } from "../controllers/agent.controller.js";

let database;
const period = { from: "2026-10-01", to: "2026-10-31" };
const at = new Date("2026-10-15T06:00:00Z");
const models = [Agent, Order, Payment, Return, AgentTargetProgress, AgentIncentiveLedger, Store];
before(async () => {
  database = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(database.getUri(), { dbName: "isolated-leaderboard" });
});
beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
after(async () => { await mongoose.disconnect(); await database?.stop(); });
const agent = (agentId, extra = {}) => Agent.collection.insertOne({ agentId, name: agentId, email: agentId + "@test.invalid", phone: agentId, status: "APPROVED", accessStatus: "ACTIVE", ...extra });
const earning = (agentId, amount, extra = {}) => AgentIncentiveLedger.collection.insertOne({ agentId, amount, type: "EARNING", status: "COMPLETED", createdAt: at, ...extra });
const order = (agentId, totalAmount, extra = {}) => Order.collection.insertOne({ orderId: new mongoose.Types.ObjectId().toString(), agentId, totalAmount, status: "PLACED", createdAt: at, ...extra });

test("earnings include monthly sales/manual credits at ledger time, never payouts or duplicated target totals", async () => {
  await agent("A"); await agent("B");
  await AgentTargetProgress.collection.insertOne({ agentId: "A", earnedAmount: 9999, isCompleted: true, createdAt: new Date("2026-09-30"), completedAt: at });
  await earning("A", 100, { source: "TARGET" });
  await earning("A", 200, { source: "TARGET", salesPeriodId: new mongoose.Types.ObjectId() });
  await earning("A", 25, { source: "MANUAL" });
  await earning("A", 300, { type: "PAYOUT" });
  await earning("A", 900, { status: "PENDING" });
  await earning("A", 1000, { createdAt: new Date("2026-09-01") });
  await earning("B", 400);
  const rows = await getLeaderboard(period);
  assert.deepEqual(rows.map(r => [r.agentId, r.earnedAmount]), [["B", 400], ["A", 325]]);
  assert.equal(rows[1].completedTargets, 1);
});

test("sales mode ranks all non-cancelled placed order value independently of incentive totals", async () => {
  await agent("A"); await agent("B");
  await earning("A", 100); await earning("B", 10);
  await order("A", 100); await order("A", 9000, { status: "CANCELLED" });
  await order("B", 300, { status: "DELIVERED" }); await order("B", 200, { status: "CONFIRMED" });
  const rows = await getLeaderboard({ ...period, metric: "SALES" });
  assert.deepEqual(rows.map(r => [r.agentId, r.sales, r.earnedAmount]), [["B", 500, 10], ["A", 100, 100]]);
  assert.equal(rows[0].ordersDelivered, 1);
  assert.equal((await getLeaderboard(period))[0].agentId, "A");
});

test("ineligible or missing agents cannot consume ranks; zero-activity active agents are included", async () => {
  await agent("ACTIVE"); await agent("LEGACY", { accessStatus: null });
  for (const status of ["BLOCKED", "DEACTIVATED", "DELETED"]) { await agent(status, { accessStatus: status }); await earning(status, 10000); }
  await agent("PENDING", { status: "PENDING" }); await earning("PENDING", 10000); await earning("MISSING", 10000);
  assert.deepEqual((await getLeaderboard({ ...period, limit: 1 })).map(r => r.agentId), ["ACTIVE"]);
  assert.equal((await getLeaderboard(period)).length, 2);
});

test("Indian calendar boundaries include both end days without expanding exact timestamp ranges", async () => {
  await agent("A");
  const { start, end } = leaderboardRange(period.from, period.to);
  assert.equal(start.toISOString(), "2026-09-30T18:30:00.000Z"); assert.equal(end.toISOString(), "2026-10-31T18:30:00.000Z");
  await earning("A", 1, { createdAt: start }); await earning("A", 2, { createdAt: new Date(end - 1) });
  await earning("A", 100, { createdAt: new Date(start - 1) }); await earning("A", 100, { createdAt: end });
  assert.equal((await getLeaderboard(period))[0].earnedAmount, 3);
  const exact = leaderboardRange("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z");
  assert.equal(exact.end.toISOString(), "2026-10-01T10:00:00.000Z");
  for (const value of [[], {}, "2026-02-30", "2026-10-01T10:00:00"]) assert.throws(() => leaderboardRange(value, period.to), { status: 400 });
});

test("ties use paise-rounded totals and immutable agent IDs before limiting in both modes", () => {
  const rows = [{ agentId: "C", earnedAmount: 0.1 + 0.2, sales: 5 }, { agentId: "B", earnedAmount: 0.3, sales: 5 }, { agentId: "A", earnedAmount: 0.3, sales: 5 }];
  for (const metric of ["INCENTIVE", "SALES"]) {
    const first = rankLeaderboard(rows, metric, 2);
    assert.deepEqual(first, rankLeaderboard([...rows].reverse(), metric, 2));
    assert.deepEqual(first.map(r => [r.agentId, r.rank]), [["A", 1], ["B", 2]]);
  }
});

test("recorded pending cash cannot inflate collected totals or incentives", async () => {
  await agent("A"); await order("A", 100, { orderId: "O", paidAmount: 100 });
  await Payment.collection.insertOne({ agentId: "A", orderId: "O", amount: 100, method: "CASH", verification: { status: "PENDING" }, createdAt: at });
  const row = (await getLeaderboard(period))[0]; assert.equal(row.sales, 100); assert.equal(row.collected, 0); assert.equal(row.earnedAmount, 0);
});

test("cached reads share calculations, separate ranking modes, and return each viewer's true rank beyond top ten", async t => {
  const now = new Date(Date.now() - 1000);
  for (let i = 1; i <= 12; i++) { const id = "A" + String(i).padStart(2, "0"); await agent(id); await earning(id, 100 - i, { createdAt: now }); await order(id, i * 100, { createdAt: now }); }
  let calls = 0, fail = true;
  const original = Order.aggregate.bind(Order);
  t.mock.method(Order, "aggregate", (...args) => { calls++; if (fail) return Promise.reject(new Error("Synthetic failure")); return original(...args); });
  t.mock.method(console, "error", () => {});
  const read = async (agentId, query = {}) => {
    let data, status = 200; const res = { setHeader() {}, status(code) { status = code; return this; }, json(value) { data = value; } };
    await leaderboard({ query: { view: "mobile", ...query }, user: { agentId } }, res); return { status, ...data };
  };
  assert.equal((await read("A12")).status, 500); fail = false;
  const results = await Promise.all(Array.from({ length: 10 }, () => read("A12")));
  assert.equal(calls, 2); const incentives = results[0];
  assert.equal(incentives.totalAgents, 12); assert.equal(incentives.data.length, 10); assert.equal(incentives.myStanding.rank, 12); assert.equal(incentives.nextAbove.rank, 11);
  const sales = await read("A12", { metric: "SALES" }); assert.equal(sales.myStanding.rank, 1); assert.equal(sales.data[0].agentId, "A12"); assert.equal(calls, 2);
  assert.equal((await read("A01")).myStanding.rank, 1);
  for (const query of [{ metric: "BAD" }, { metric: [] }, { limit: "2x" }, { limit: "1.5" }, { from: [] }]) assert.equal((await read("A01", query)).status, 400);
});
