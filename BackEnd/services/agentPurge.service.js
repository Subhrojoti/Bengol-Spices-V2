import mongoose from "mongoose";
import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Invoice from "../models/Invoice.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import GatewayPayment from "../models/GatewayPayment.js";
import AgentSalesLocation from "../models/AgentSalesLocation.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import AgentSalesPeriod from "../models/AgentSalesPeriod.js";
import SalesTargetConfig from "../models/SalesTargetConfig.js";
import SalesTargetChange from "../models/SalesTargetChange.js";
import Target from "../models/Target.js";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { invoicePublicId } from "../utils/uploadPdf.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";
import { assignmentFilter, managerOf } from "./storeAccess.service.js";
import { withStoreLocks } from "./storeOperation.service.js";
import { withLock } from "./payment.service.js";
import { confirmation, readConfirmation, hash, refuse, runAdminOperation } from "./adminManagement.service.js";
import { mediaAssetOf, assetIsReferenced, processMediaCleanup, getMediaCleanup } from "./mediaCleanup.service.js";

const load = async (model, filter, session) => {
  const rows = await model.find(filter).session(session).limit(5001).lean();
  if (rows.length > 5000) refuse("This test account is too large for one safe cleanup. Use a reviewed offline cleanup.", 409);
  return rows;
};
const ids = (rows) => rows.map((r) => r._id);
const other = (value, agentId) => Boolean(value && value !== agentId);

const purgePlan = async (agentId, session = null) => {
  if (typeof agentId !== "string" || !agentId.trim() || agentId.length > 100) refuse("A valid agent ID is required");
  const agent = await Agent.findOne({ agentId }).session(session).lean();
  if (!agent) refuse("Agent not found", 404);
  const stores = await load(Store, { $or: [{ registeredBy: agentId }, assignmentFilter(agentId)] }, session);
  if (stores.length > 1000) refuse("At most 1000 stores can be removed in one test-account cleanup", 409);
  const consumerIds = stores.map((s) => s.consumerId);
  const orders = await load(Order, { $or: [{ agentId }, { consumerId: { $in: consumerIds } }, { store: { $in: ids(stores) } }] }, session);
  const orderIds = orders.map((o) => o.orderId);
  const reference = { $or: [{ agentId }, { consumerId: { $in: consumerIds } }, { orderId: { $in: orderIds } }] };
  const payments = await load(Payment, { $or: [...reference.$or, { "collectedBy.id": agentId }] }, session);
  const returns = await load(Return, { $or: [...reference.$or, { "initiatedBy.id": agentId }] }, session);
  const gateways = await load(GatewayPayment, { $or: [{ agentId }, { orderId: { $in: orderIds } }] }, session);
  const invoices = await load(Invoice, { orderId: { $in: orderIds } }, session);
  const delivery = await load(DeliveryEvent, { orderId: { $in: orderIds } }, session);
  const assignedTargets = await load(Target, { assignedAgentIds: agentId }, session);
  const exclusiveTargets = assignedTargets.filter((t) => t.assignedAgentIds.length === 1);
  const sharedTargets = assignedTargets.filter((t) => t.assignedAgentIds.length > 1);
  const touchedConsumers = [...new Set([...orders, ...payments, ...returns].map((r) => r.consumerId).filter(Boolean))];
  const outsideStores = await load(Store, { consumerId: { $in: touchedConsumers }, _id: { $nin: ids(stores) } }, session);
  const outsideOrderIds = [...new Set([...payments, ...returns, ...gateways].map((r) => r.orderId).filter((v) => v && !orderIds.includes(v)))];
  const outsideOrders = await load(Order, { orderId: { $in: outsideOrderIds } }, session);
  const foreignProgress = await AgentTargetProgress.countDocuments({ targetId: { $in: ids(exclusiveTargets) }, agentId: { $ne: agentId } }).session(session);
  const conflicts = [];
  if (stores.some((s) => other(s.registeredBy, agentId) || other(managerOf(s), agentId)) || outsideStores.length) conflicts.push("This agent has transferred or inherited stores. Shared store history must be separated before complete deletion.");
  if (orders.some((o) => other(o.agentId, agentId)) || outsideOrders.length || payments.some((p) => other(p.agentId, agentId) || other(p.collectedBy?.id, agentId)) || returns.some((r) => other(r.agentId, agentId)) || gateways.some((g) => other(g.agentId, agentId)) || foreignProgress) conflicts.push("Some related transactions or targets belong to another agent. Complete deletion is blocked to preserve their records.");
  if (agent.status === "APPROVED" && (agent.accessStatus || "ACTIVE") === "ACTIVE") conflicts.push("Block or deactivate this agent before permanently deleting test data.");
  if (gateways.some((g) => g.status === "PROCESSING")) conflicts.push("A gateway payment is still processing. Resolve it in Payment Issues before cleanup.");

  const entries = [
    ["agents", Agent, [agent]], ["stores", Store, stores], ["orders", Order, orders],
    ["payments", Payment, payments], ["returns", Return, returns], ["invoices", Invoice, invoices],
    ["deliveryEvents", DeliveryEvent, delivery], ["gatewayPayments", GatewayPayment, gateways],
    ["territories", AgentSalesLocation, await load(AgentSalesLocation, { agentId }, session)],
    ["targetProgress", AgentTargetProgress, await load(AgentTargetProgress, { agentId }, session)],
    ["incentives", AgentIncentiveLedger, await load(AgentIncentiveLedger, { agentId }, session)],
    ["salesPeriods", AgentSalesPeriod, await load(AgentSalesPeriod, { agentId }, session)],
    ["salesSettings", SalesTargetConfig, await load(SalesTargetConfig, { scope: "AGENT", agentId }, session)],
    ["salesChanges", SalesTargetChange, await load(SalesTargetChange, { scope: "AGENT", agentId }, session)],
    ["agentOnlyTargets", Target, exclusiveTargets],
    ["notifications", Notification, await load(Notification, { $or: [
      { recipientModel: "Agent", $or: [{ recipientId: agent._id }, { recipientCode: agentId }] },
      { senderId: agent._id }, { "meta.orderId": { $in: orderIds } },
      { "meta.paymentId": { $in: ids(payments).map(String) } }, { "meta.consumerId": { $in: consumerIds } },
    ] }, session)],
  ];
  const exclusions = new Map(entries.map(([, model, rows]) => [model.modelName, ids(rows)]));
  const urls = [...Object.values(agent.documents || {}), ...(agent.applicationHistory || []).flatMap((a) => Object.values(a.documents || {})), ...stores.map((s) => s.image?.url), ...invoices.map((i) => i.pdfUrl)].filter((v) => typeof v === "string" && v);
  if (urls.some((url) => /^https:\/\/res\.cloudinary\.com\//.test(url) && !mediaAssetOf(url))) conflicts.push("Some Cloudinary files cannot be matched to this server's storage account. Review storage settings and file references before deleting this agent.");
  const candidates = urls.map(mediaAssetOf).filter(Boolean);
  for (const invoice of invoices) if (invoice.invoiceNumber && mediaAssetOf(invoice.pdfUrl)) {
    // Older invoice uploads used a .pdf suffix inside their public ID. Keep
    // both known names in cleanup, rather than treating that suffix as a format.
    for (const publicId of [invoicePublicId(invoice.invoiceNumber), `bengol_spices/invoices/${invoiceFileName(invoice.invoiceNumber)}.pdf`]) candidates.push({ publicId, cloudName: mediaAssetOf(invoice.pdfUrl).cloudName, resourceType: "image", assetKey: `image:${publicId}` });
  }
  const assets = [...new Map(candidates.map((asset) => [asset.assetKey, asset])).values()];
  let sharedFiles = 0;
  for (const asset of assets) if (await assetIsReferenced(asset, exclusions, session)) sharedFiles++;
  const unrecognizedFiles = new Set(urls.filter((url) => !mediaAssetOf(url))).size;
  const stock = new Map();
  for (const order of orders) if (order.status !== "CANCELLED") for (const line of order.products || []) {
    if (!mongoose.isValidObjectId(line.productId) || !Number.isFinite(line.quantity) || line.quantity <= 0) continue;
    const key = String(line.productId);
    const previous = stock.get(key) || { productId: key, name: line.name, quantity: 0 };
    previous.quantity += line.quantity; stock.set(key, previous);
  }
  const fingerprint = hash({ entries: entries.map(([key, , rows]) => [key, rows.map((row) => hash(row)).sort()]), sharedTargets: sharedTargets.map((row) => hash(row)).sort(), assets, sharedFiles, unrecognizedFiles });
  return { agent, stores, entries, sharedTargets, assets, stock: [...stock.values()], conflicts, fingerprint,
    counts: { ...Object.fromEntries(entries.map(([key, , rows]) => [key, rows.length])), sharedTargetAssignments: sharedTargets.length, files: assets.length, sharedFiles, unrecognizedFiles } };
};

export const previewAgentPurge = async (agentId) => {
  const plan = await purgePlan(agentId);
  return { success: true, agent: { agentId, name: plan.agent.name, accessStatus: plan.agent.accessStatus || "ACTIVE" },
    allowed: plan.conflicts.length === 0, blockers: plan.conflicts, counts: plan.counts,
    stock: plan.stock, stores: plan.stores.map((s) => ({ consumerId: s.consumerId, storeName: s.storeName })),
    removes: ["Agent account and application history", "All of this test agent's stores, orders, payments, invoices, returns and delivery events", "Agent-only targets, progress, incentives, territories, sales settings/history and related notifications", "Unshared uploaded identity documents, store images and invoice PDFs"],
    preserves: ["Administrative deletion receipts", "Shared targets, product catalogue, other agents/employees/delivery accounts", "Files still used by another record"],
    warnings: ["This cannot be undone. Confirm these are fake/test records before continuing.", "Gateway records are removed locally. This does not refund payments or delete Razorpay's records.", ...(plan.counts.unrecognizedFiles ? ["Some file URLs are external or cannot be safely identified. They require manual file cleanup."] : [])],
    confirmationToken: confirmation({ kind: "PURGE_AGENT", agentId, consumerIds: plan.stores.map((s) => s.consumerId), fingerprint: plan.fingerprint }) };
};

export const purgeAgent = async (agentId, body, actor) => {
  const signed = readConfirmation(body.confirmationToken);
  if (signed.kind !== "PURGE_AGENT" || signed.agentId !== agentId) refuse("Wrong agent deletion confirmation");
  if (body.confirmIdentifier !== agentId || body.confirmPhrase !== "DELETE TEST DATA" || body.testDataConfirmed !== true) refuse("Type the agent ID and DELETE TEST DATA, and confirm this is test data");
  if (typeof body.restoreStock !== "boolean") refuse("Choose whether test-order quantities should be restored to stock");
  const run = async () => runAdminOperation({ requestId: body.requestId, input: { token: body.confirmationToken, restoreStock: body.restoreStock }, action: "PURGE_TEST_AGENT", actor,
    context: { sourceAgentId: agentId, consumerIds: signed.consumerIds, details: { permanent: true } },
    work: async (session) => {
      const plan = await purgePlan(agentId, session);
      if (plan.conflicts.length) refuse(plan.conflicts.join(" "), 409);
      if (plan.fingerprint !== signed.fingerprint) refuse("Agent data changed. Review a fresh deletion preview.", 409);
      if (body.restoreStock) for (const item of plan.stock) await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }, { session });
      // Shared targets must never become global by accidentally emptying their list.
      if (plan.sharedTargets.length) await Target.updateMany({ _id: { $in: ids(plan.sharedTargets) } }, { $pull: { assignedAgentIds: agentId } }, { session });
      if (plan.assets.length) await MediaDeletionJob.create(plan.assets.map((asset) => ({ ...asset, batchId: body.requestId })), { session, ordered: true });
      for (const [, model, rows] of [...plan.entries].reverse()) if (rows.length) await model.deleteMany({ _id: { $in: ids(rows) } }, { session });
      return { sourceAgentId: agentId, consumerIds: signed.consumerIds,
        details: { permanent: true, testDataConfirmed: true, removed: plan.counts, restoreStock: body.restoreStock, stock: body.restoreStock ? plan.stock : [] },
        result: { success: true, message: "Test agent and associated database records permanently deleted.", removed: plan.counts, cleanupBatchId: body.requestId, unrecognizedFiles: plan.counts.unrecognizedFiles } };
    } });
  await MediaDeletionJob.init();
  const locked = await withStoreLocks(signed.consumerIds, async () => {
    const account = await withLock(`agent-management:${agentId}`, async () => {
      const payout = await withLock(`incentive-payout:${agentId}`, run, { leaseMs: 10 * 60 * 1000 });
      if (payout.busy) refuse("An incentive payout is being recorded. Retry after it finishes.", 409);
      return payout.value;
    }, { leaseMs: 10 * 60 * 1000 });
    if (account.busy) refuse("This agent is being updated. Please retry shortly.", 409);
    return account.value;
  });
  let cleanup;
  try { cleanup = await processMediaCleanup(body.requestId); }
  catch { cleanup = await getMediaCleanup(body.requestId).catch(() => ({ batchId: body.requestId, statusUnavailable: true })); }
  return { ...locked, cleanup };
};
