import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Invoice from "../models/Invoice.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import GatewayPayment from "../models/GatewayPayment.js";
import Notification from "../models/Notification.js";
import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentSalesPeriod from "../models/AgentSalesPeriod.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { confirmation, readConfirmation, hash, refuse, runAdminOperation } from "./adminManagement.service.js";
import { managerOf } from "./storeAccess.service.js";
import { withStoreLocks } from "./storeOperation.service.js";
import { withLock } from "./payment.service.js";
import { mediaAssetOf, assetIsReferenced, processMediaCleanup, getMediaCleanup } from "./mediaCleanup.service.js";
import { invoicePublicId } from "../utils/uploadPdf.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";
import { monthKeyOf } from "../utils/salesTarget.js";

const ids = (rows) => rows.map((row) => row._id);
const load = async (model, filter, session) => {
  const rows = await model.find(filter).session(session).limit(5001).lean();
  if (rows.length > 5000) refuse("This store has too many records for one cleanup. Use a reviewed offline cleanup.", 409);
  return rows;
};
const dateOf = (value) => value ? new Date(value).getTime() : NaN;

const purgePlan = async (consumerId, session = null) => {
  if (typeof consumerId !== "string" || !consumerId.trim() || consumerId.length > 100) refuse("A valid store ID is required");
  const store = await Store.findOne({ consumerId }).session(session).lean();
  if (!store) refuse("Store not found", 404);
  const orders = await load(Order, { $or: [{ consumerId }, { store: store._id }] }, session);
  const orderIds = orders.map((order) => order.orderId);
  const reference = { $or: [{ consumerId }, { orderId: { $in: orderIds } }] };
  const payments = await load(Payment, reference, session);
  const returns = await load(Return, reference, session);
  const gateways = await load(GatewayPayment, { $or: [
    { orderId: { $in: orderIds } },
    { razorpayPaymentIds: { $in: payments.map((p) => p.razorpayPaymentId).filter(Boolean) } },
    { razorpayOrderId: { $in: payments.map((p) => p.razorpayOrderId).filter(Boolean) } },
  ] }, session);
  const invoices = await load(Invoice, { orderId: { $in: orderIds } }, session);
  const delivery = await load(DeliveryEvent, { orderId: { $in: orderIds } }, session);
  const notifications = await load(Notification, { $or: [
    { "meta.consumerId": consumerId }, { "meta.orderId": { $in: orderIds } },
    { "meta.returnId": { $in: returns.map((r) => r.returnId) } },
    { "meta.paymentId": { $in: [...ids(payments), ...ids(payments).map(String)] } },
  ] }, session);
  const agentId = store.registeredBy;
  const blockers = [];
  if (!agentId || managerOf(store) !== agentId || [...orders, ...payments, ...returns, ...gateways].some((row) => row.agentId && row.agentId !== agentId)) blockers.push("Transferred or shared-agent history needs review before deleting this store.");
  if (orders.some((order) => (order.consumerId && order.consumerId !== consumerId) || (order.store && String(order.store) !== String(store._id))) || [...payments, ...returns].some((row) => (row.consumerId && row.consumerId !== consumerId) || !orderIds.includes(row.orderId))) blockers.push("Some records reference another store or an unavailable order. Review those links before cleanup.");
  if (payments.some((p) => p.collectedBy?.id && p.collectedBy.id !== agentId) || notifications.some(({ meta = {} }) => (meta.consumerId && meta.consumerId !== consumerId) || (meta.orderId && !orderIds.includes(meta.orderId)) || (meta.returnId && !returns.some((r) => r.returnId === meta.returnId)) || (meta.paymentId && !payments.some((p) => String(p._id) === String(meta.paymentId))))) blockers.push("Some linked records are shared with another store or collector. Review them separately before cleanup.");
  if (orders.some((order) => order.status !== "CANCELLED")) blockers.push("Cancel all test orders before deleting this store. Active and delivered orders cannot be removed here.");
  if (returns.some((row) => !["CANCELLED", "COMPLETED", "REFUND_PROCESSED"].includes(row.status))) blockers.push("Close or cancel this store's returns before cleanup.");
  // Keep external payment replay/refund tracking intact. This limited cleanup
  // is for cancelled test history, not removal of real gateway transactions.
  if (gateways.length || orders.some((o) => o.paymentMode === "RAZORPAY") || payments.some((p) => p.method === "RAZORPAY" || p.razorpayPaymentId || p.razorpayOrderId || p.razorpaySignature)) blockers.push("Online payment records require separate review. This cleanup cannot erase gateway payment or refund tracking.");

  // Aggregate target progress has no per-store attribution. Credits can happen
  // after creation (PDF upload, later cash approval), so conservatively block
  // any matching target that could have received this activity after creation.
  // Targets already ended before the event are unrelated and remain intact.
  const events = [
    { type: "STORE_CREATION", at: store.createdAt },
    ...orders.map((order) => ({ type: "ORDER", at: order.createdAt })),
    ...payments.flatMap((payment) => [{ type: "PAYMENT", at: payment.createdAt }, { type: "PAYMENT", at: payment.verification?.decidedAt || payment.createdAt }]),
  ];
  const progress = await load(AgentTargetProgress, { agentId }, session);
  const targets = await load(Target, { _id: { $in: progress.map((p) => p.targetId) } }, session);
  const targetMap = new Map(targets.map((target) => [String(target._id), target]));
  const affectedProgress = progress.filter((row) => {
    const target = targetMap.get(String(row.targetId));
    return events.some((event) => {
      if ((row.type || target?.type) && (row.type || target.type) !== event.type) return false;
      const at = dateOf(event.at), start = dateOf(target?.startDate), end = dateOf(target?.endDate);
      return !Number.isFinite(at) || !Number.isFinite(start) || !Number.isFinite(end) || (end >= at && start <= Date.now());
    });
  });
  if (affectedProgress.length) blockers.push("This store's activity overlaps target progress or rewards. Review target accounting separately; shared agent progress will not be erased.");
  const months = [...new Set(payments.map((p) => p.createdAt).filter((at) => Number.isFinite(dateOf(at))).map(monthKeyOf))];
  if (payments.some((p) => !Number.isFinite(dateOf(p.createdAt)))) blockers.push("A payment has no reliable collection date. Review its sales accounting before cleanup.");
  const closedPeriods = await load(AgentSalesPeriod, { agentId, month: { $in: months }, $or: [{ closedAt: { $ne: null } }, { incentiveEarnedAt: { $ne: null } }] }, session);
  if (closedPeriods.length) blockers.push("Payments overlap a closed or rewarded sales month. Review that accounting before cleanup.");

  const entries = [["stores", Store, [store]], ["orders", Order, orders], ["payments", Payment, payments], ["returns", Return, returns], ["invoices", Invoice, invoices], ["deliveryEvents", DeliveryEvent, delivery], ["gatewayPayments", GatewayPayment, gateways], ["notifications", Notification, notifications]];
  const exclusions = new Map(entries.map(([, model, rows]) => [model.modelName, ids(rows)]));
  const urls = [store.image?.url, ...invoices.map((invoice) => invoice.pdfUrl)].filter((url) => typeof url === "string" && url);
  if (urls.some((url) => /^https:\/\/res\.cloudinary\.com\//.test(url) && !mediaAssetOf(url))) blockers.push("Some Cloudinary files cannot be matched to this storage account. Review file references before cleanup.");
  const candidates = urls.map(mediaAssetOf).filter(Boolean);
  for (const invoice of invoices) {
    const asset = mediaAssetOf(invoice.pdfUrl);
    if (!asset || !invoice.invoiceNumber) continue;
    const storedPdfId = asset.resourceType === "image" && /\.pdf(?:[?#]|$)/i.test(invoice.pdfUrl) ? `${asset.publicId}.pdf` : null;
    for (const publicId of [storedPdfId, invoicePublicId(invoice.invoiceNumber), `bengol_spices/invoices/${invoiceFileName(invoice.invoiceNumber)}.pdf`].filter(Boolean)) candidates.push({ publicId, cloudName: asset.cloudName, resourceType: "image", assetKey: `image:${publicId}` });
  }
  const assets = [...new Map(candidates.map((asset) => [asset.assetKey, asset])).values()];
  let sharedFiles = 0;
  for (const asset of assets) if (await assetIsReferenced(asset, exclusions, session)) sharedFiles++;
  const unrecognizedFiles = new Set(urls.filter((url) => !mediaAssetOf(url))).size;
  const counts = { ...Object.fromEntries(entries.map(([key, , rows]) => [key, rows.length])), targetProgressConflicts: affectedProgress.length, salesPeriodConflicts: closedPeriods.length, files: assets.length, sharedFiles, unrecognizedFiles };
  const fingerprint = hash({ entries: entries.map(([key, , rows]) => [key, rows.map(hash).sort()]), affectedProgress: affectedProgress.map(hash).sort(), closedPeriods: closedPeriods.map(hash).sort(), assets, sharedFiles, unrecognizedFiles, blockers });
  return { store, entries, assets, counts, blockers, fingerprint };
};

export const previewStorePurge = async (consumerId) => {
  const plan = await purgePlan(consumerId);
  return { success: true, store: { consumerId, storeName: plan.store.storeName, registeredBy: plan.store.registeredBy, currentAgentId: managerOf(plan.store) },
    allowed: !plan.blockers.length, blockers: plan.blockers, counts: plan.counts,
    removes: ["This store and its cancelled orders", "Linked payment, invoice, closed return, delivery and notification records", "Unshared uploaded store photo and invoice PDFs"],
    preserves: ["Agent account and all other stores", "Agent settings, targets, incentives and sales-period records", "Products and stock quantities", "Administrative deletion receipt and files used by other records"],
    warnings: ["Use only for fake/test data. Deletion is permanent. Stop activity on this store before confirming.", "Cancelled orders already released their stock. This cleanup does not add stock again or refund any money.", ...(plan.counts.unrecognizedFiles ? ["External or unrecognized files require manual cleanup."] : [])],
    confirmationToken: confirmation({ kind: "PURGE_STORE", consumerIds: [consumerId], agentId: plan.store.registeredBy, fingerprint: plan.fingerprint }) };
};

export const purgeStore = async (consumerId, body, actor) => {
  const signed = readConfirmation(body.confirmationToken);
  if (signed.kind !== "PURGE_STORE" || signed.consumerIds?.length !== 1 || signed.consumerIds[0] !== consumerId) refuse("Wrong store deletion confirmation");
  if (body.confirmIdentifier !== consumerId || body.confirmPhrase !== "DELETE TEST STORE" || body.testDataConfirmed !== true) refuse("Type the store ID and DELETE TEST STORE, and confirm this is test data");
  await MediaDeletionJob.init();
  const result = await withStoreLocks([consumerId], async () => {
    const locked = await withLock(`agent-management:${signed.agentId}`, () => runAdminOperation({ requestId: body.requestId, input: { token: body.confirmationToken, consumerId }, action: "PURGE_TEST_STORE", actor,
      context: { sourceAgentId: signed.agentId, consumerIds: [consumerId] },
      work: async (session) => {
        const plan = await purgePlan(consumerId, session);
        if (plan.blockers.length) refuse(plan.blockers.join(" "), 409);
        if (plan.fingerprint !== signed.fingerprint) refuse("Store data changed. Review a fresh test-store cleanup preview.", 409);
        if (plan.assets.length) await MediaDeletionJob.create(plan.assets.map((asset) => ({ ...asset, batchId: body.requestId })), { session, ordered: true });
        for (const [, model, rows] of [...plan.entries].reverse()) if (rows.length) await model.deleteMany({ _id: { $in: ids(rows) } }, { session });
        return { sourceAgentId: signed.agentId, consumerIds: [consumerId], details: { permanent: true, testDataConfirmed: true, removed: plan.counts, stockChanged: false },
          result: { success: true, message: "Test store and linked records permanently deleted. Agent and other stores retained.", removed: plan.counts, cleanupBatchId: body.requestId, unrecognizedFiles: plan.counts.unrecognizedFiles } };
      } }), { leaseMs: 10 * 60 * 1000 });
    if (locked.busy) refuse("This agent is being updated. Retry after it finishes.", 409);
    return locked.value;
  });
  let cleanup;
  try { cleanup = await processMediaCleanup(body.requestId); }
  catch { cleanup = await getMediaCleanup(body.requestId).catch(() => ({ batchId: body.requestId, statusUnavailable: true })); }
  return { ...result, cleanup };
};
