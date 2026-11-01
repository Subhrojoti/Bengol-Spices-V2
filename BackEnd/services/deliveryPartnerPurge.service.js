import mongoose from "mongoose";
import DeliveryPartner from "../models/DeliveryPartner.js";
import DispatchMapping from "../models/DispatchMapping.js";
import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Invoice from "../models/Invoice.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import OrderModification from "../models/OrderModification.js";
import GatewayPayment from "../models/GatewayPayment.js";
import Notification from "../models/Notification.js";
import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentSalesPeriod from "../models/AgentSalesPeriod.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { confirmation, readConfirmation, hash, refuse, runAdminOperation } from "./adminManagement.service.js";
import { mediaAssetOf, assetIsReferenced, processMediaCleanup, getMediaCleanup } from "./mediaCleanup.service.js";
import { withStoreLocks } from "./storeOperation.service.js";
import { withLock } from "./payment.service.js";
import { monthKeyOf } from "../utils/salesTarget.js";
import { invoicePublicId } from "../utils/uploadPdf.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";
import { managerOf } from "./storeAccess.service.js";

const ids = rows => rows.map(row => row._id);
const load = async (model, filter, session) => {
  const rows = await model.find(filter).session(session).limit(5001).lean();
  if (rows.length > 5000) refuse("Too many records for one safe cleanup. Use a reviewed offline cleanup.", 409);
  return rows;
};
const dateOf = value => value ? new Date(value).getTime() : NaN;
const planPurge = async (partnerId, session = null) => {
  if (typeof partnerId !== "string" || !/^[a-f0-9]{24}$/i.test(partnerId)) refuse("A valid delivery partner ID is required");
  const partner = await DeliveryPartner.findById(partnerId).select("+activityVersion").session(session).lean();
  if (!partner) refuse("Delivery partner not found", 404);
  const collected = await load(Payment, { "collectedBy.role": "DELIVERY_PARTNER", "collectedBy.id": partnerId }, session);
  const ownEvents = await load(DeliveryEvent, { $or: [{ partnerId }, { "by.role": "DELIVERY_PARTNER", "by.id": partnerId }] }, session);
  const pickups = await load(Return, { "pickup.partnerId": partnerId }, session);
  const linkedIds = [...new Set([...collected, ...ownEvents, ...pickups].map(row => row.orderId).filter(Boolean))];
  const orders = await load(Order, { $or: [{ "delivery.partnerId": partnerId }, { "assignmentHistory.partnerId": partnerId }, { "assignmentHistory.previousPartnerId": partnerId }, { orderId: { $in: linkedIds } }] }, session);
  const orderIds = orders.map(row => row.orderId), consumerIds = [...new Set(orders.map(row => row.consumerId).filter(Boolean))];
  const reference = { orderId: { $in: orderIds } };
  const payments = await load(Payment, reference, session), returns = await load(Return, reference, session);
  const invoices = await load(Invoice, reference, session), events = await load(DeliveryEvent, reference, session);
  const gateways = await load(GatewayPayment, { $or: [reference, { razorpayOrderId: { $in: payments.map(p => p.razorpayOrderId).filter(Boolean) } }, { razorpayPaymentIds: { $in: payments.map(p => p.razorpayPaymentId).filter(Boolean) } }] }, session);
  const stores = await load(Store, { consumerId: { $in: consumerIds } }, session);
  const blockers = [], foreign = value => value && String(value) !== partnerId;
  if ([...collected, ...ownEvents, ...pickups].some(row => !row.orderId) || linkedIds.some(id => !orderIds.includes(id))) blockers.push("Some collections or delivery records have no linked order. Review those records before cleanup.");
  if (orders.some(o => o.status !== "CANCELLED")) blockers.push("Cancel all linked test orders before cleanup. Active and delivered orders cannot be deleted here.");
  if (returns.some(r => !["CANCELLED", "COMPLETED", "REFUND_PROCESSED"].includes(r.status))) blockers.push("Close or cancel linked return pickups before cleanup.");
  if (orders.some(o => foreign(o.delivery?.partnerId) || (o.assignmentHistory || []).some(a => foreign(a.partnerId) || foreign(a.previousPartnerId))) || returns.some(r => foreign(r.pickup?.partnerId)) || events.some(e => foreign(e.partnerId) || e.by?.role === "DELIVERY_PARTNER" && foreign(e.by.id)) || payments.some(p => p.collectedBy?.role === "DELIVERY_PARTNER" && foreign(p.collectedBy.id))) blockers.push("Linked business history involves another delivery partner. Shared records must be reviewed separately.");
  const storeMap = new Map(stores.map(s => [s.consumerId, s]));
  if (stores.some(s => managerOf(s) !== s.registeredBy) || orders.some(o => storeMap.get(o.consumerId)?.registeredBy !== o.agentId)) blockers.push("Transferred stores or shared-agent history require separate review before deleting linked test records.");
  if (orders.some(o => !o.agentId || !storeMap.has(o.consumerId) || o.store && String(o.store) !== String(storeMap.get(o.consumerId)._id)) || [...payments, ...returns].some(row => { const order = orders.find(o => o.orderId === row.orderId); return !order || row.agentId && row.agentId !== order.agentId || row.consumerId && row.consumerId !== order.consumerId; })) blockers.push("Some records have inconsistent store or sales-agent links. Resolve these before cleanup.");
  if (gateways.length || orders.some(o => o.paymentMode === "RAZORPAY") || payments.some(p => p.method === "RAZORPAY" || p.razorpayPaymentId || p.razorpayOrderId || p.razorpaySignature)) blockers.push("Online payment and refund tracking cannot be erased by test-partner cleanup.");

  // Shared agent accounting has no reversible per-order reward attribution.
  const agentIds = [...new Set(orders.map(o => o.agentId).filter(Boolean))];
  const progress = await load(AgentTargetProgress, { agentId: { $in: agentIds } }, session);
  const targets = await load(Target, { _id: { $in: progress.map(p => p.targetId) } }, session);
  const targetMap = new Map(targets.map(t => [String(t._id), t]));
  const activity = [...orders.map(o => ({ agentId: o.agentId, type: "ORDER", at: o.createdAt })), ...payments.flatMap(p => [{ agentId: p.agentId, type: "PAYMENT", at: p.createdAt }, { agentId: p.agentId, type: "PAYMENT", at: p.verification?.decidedAt || p.createdAt }])];
  const affectedProgress = progress.filter(p => activity.some(event => {
    const target = targetMap.get(String(p.targetId));
    if (p.agentId !== event.agentId || (p.type || target?.type) && (p.type || target.type) !== event.type) return false;
    const at = dateOf(event.at), start = dateOf(target?.startDate), end = dateOf(target?.endDate);
    return !Number.isFinite(at) || !Number.isFinite(start) || !Number.isFinite(end) || end >= at && start <= Date.now();
  }));
  if (affectedProgress.length) blockers.push("Linked orders or payments overlap sales-agent target progress or rewards. Shared accounting will not be erased.");
  if (payments.some(p => !Number.isFinite(dateOf(p.createdAt)))) blockers.push("A payment has no reliable accounting date. Review it before cleanup.");
  const months = [...new Set(payments.filter(p => Number.isFinite(dateOf(p.createdAt))).map(p => monthKeyOf(p.createdAt)))];
  const closed = await load(AgentSalesPeriod, { agentId: { $in: agentIds }, month: { $in: months }, $or: [{ closedAt: { $ne: null } }, { incentiveEarnedAt: { $ne: null } }] }, session);
  if (closed.length) blockers.push("Linked payments overlap a closed or rewarded sales month. Review that accounting separately.");
  const notifications = await load(Notification, { $or: [{ recipientModel: "DeliveryPartner", recipientId: partner._id }, { "meta.orderId": { $in: orderIds } }, { "meta.returnId": { $in: returns.map(r => r.returnId) } }, { "meta.paymentId": { $in: [...ids(payments), ...ids(payments).map(String)] } }] }, session);
  if (notifications.some(n => n.meta?.orderId && !orderIds.includes(n.meta.orderId) || n.meta?.returnId && !returns.some(r => r.returnId === n.meta.returnId) || n.meta?.paymentId && !payments.some(p => String(p._id) === String(n.meta.paymentId)))) blockers.push("A notification links to other business records. Review the shared history before cleanup.");
  const entries = [["partners", DeliveryPartner, [partner]], ["mappings", DispatchMapping, await load(DispatchMapping, { partnerId }, session)], ["orders", Order, orders], ["payments", Payment, payments], ["returns", Return, returns], ["invoices", Invoice, invoices], ["deliveryEvents", DeliveryEvent, events], ["orderModifications", OrderModification, await load(OrderModification, reference, session)], ["notifications", Notification, notifications]];
  const urls = [partner.documents?.documentUrl, ...invoices.map(i => i.pdfUrl)].filter(Boolean);
  if (urls.some(url => /^https:\/\/res\.cloudinary\.com\//.test(url) && !mediaAssetOf(url))) blockers.push("Some uploaded files cannot be safely matched to this server's storage account. Review them before cleanup.");
  const candidates = urls.map(mediaAssetOf).filter(Boolean);
  for (const invoice of invoices) if (invoice.invoiceNumber && mediaAssetOf(invoice.pdfUrl)) for (const publicId of [invoicePublicId(invoice.invoiceNumber), `bengol_spices/invoices/${invoiceFileName(invoice.invoiceNumber)}.pdf`]) candidates.push({ ...mediaAssetOf(invoice.pdfUrl), publicId, assetKey: `image:${publicId}`, resourceType: "image" });
  const assets = [...new Map(candidates.map(asset => [asset.assetKey, asset])).values()];
  const exclusions = new Map(entries.map(([, model, rows]) => [model.modelName, ids(rows)]));
  let sharedFiles = 0;
  for (const asset of assets) if (await assetIsReferenced(asset, exclusions, session)) sharedFiles++;
  const counts = { ...Object.fromEntries(entries.map(([key, , rows]) => [key, rows.length])), files: assets.length, sharedFiles, unrecognizedFiles: new Set(urls.filter(url => !mediaAssetOf(url))).size };
  const fingerprint = hash({ entries: entries.map(([key, , rows]) => [key, rows.map(hash).sort()]), assets, counts, blockers });
  return { partner, orders, consumerIds, entries, assets, counts, blockers, fingerprint };
};

export const previewDeliveryPartnerPurge = async partnerId => {
  const plan = await planPurge(partnerId);
  return { success: true, partner: { id: partnerId, name: plan.partner.name, phone: plan.partner.phone }, counts: plan.counts, allowed: !plan.blockers.length, blockers: plan.blockers,
    orders: plan.orders.map(o => ({ orderId: o.orderId, consumerId: o.consumerId, agentId: o.agentId, status: o.status })),
    removes: ["Test delivery partner account, mappings and partner notifications", "Listed cancelled test orders, payments, invoices, returns and delivery history", "Unshared identity document and invoice PDFs"],
    preserves: ["Sales agents, stores and store photos", "Unrelated orders, payments, targets and incentives", "Deletion receipts and files still used by another record"],
    warnings: ["Permanent deletion cannot be undone. Confirm every listed order and payment is fake/test data.", "Stock is unchanged: cancelling orders already applies existing stock handling.", ...(plan.counts.unrecognizedFiles ? ["External file URLs require manual cleanup; this server cannot remove those files."] : [])],
    confirmationToken: confirmation({ kind: "PURGE_DELIVERY_PARTNER", partnerId, consumerIds: plan.consumerIds, fingerprint: plan.fingerprint }) };
};

export const purgeDeliveryPartner = async (partnerId, body, actor) => {
  const signed = readConfirmation(body.confirmationToken);
  if (signed.kind !== "PURGE_DELIVERY_PARTNER" || signed.partnerId !== partnerId) refuse("Wrong delivery partner confirmation");
  if (body.confirmIdentifier !== partnerId || body.confirmPhrase !== "DELETE TEST DELIVERY DATA" || body.testDataConfirmed !== true) refuse("Type the partner ID and DELETE TEST DELIVERY DATA, and confirm all listed records are test data");
  await MediaDeletionJob.init();
  const result = await withStoreLocks(signed.consumerIds, async () => {
    const lock = await withLock(`partner-cleanup:${partnerId}`, () => runAdminOperation({ requestId: body.requestId, input: { token: body.confirmationToken }, action: "PURGE_TEST_DELIVERY_PARTNER", actor, context: { sourcePartnerId: partnerId }, work: async session => {
      const plan = await planPurge(partnerId, session);
      if (plan.blockers.length) refuse(plan.blockers.join(" "), 409);
      if (plan.fingerprint !== signed.fingerprint) refuse("Partner data changed. Review a fresh deletion preview.", 409);
      if (plan.assets.length) await MediaDeletionJob.create(plan.assets.map(asset => ({ ...asset, batchId: body.requestId })), { session, ordered: true });
      for (const [, model, rows] of [...plan.entries].reverse()) if (rows.length) await model.deleteMany({ _id: { $in: ids(rows) } }, { session });
      return { sourcePartnerId: partnerId, consumerIds: plan.consumerIds, details: { permanent: true, testDataConfirmed: true, partner: { id: partnerId, name: plan.partner.name }, removed: plan.counts }, result: { success: true, message: "Test delivery partner and listed test business records permanently deleted.", removed: plan.counts, cleanupBatchId: body.requestId, unrecognizedFiles: plan.counts.unrecognizedFiles } };
    } }), { leaseMs: 10 * 60 * 1000 });
    if (lock.busy) refuse("Another cleanup is in progress. Retry with the same request ID.", 409);
    return lock.value;
  });
  let cleanup;
  try { cleanup = await processMediaCleanup(body.requestId); }
  catch { cleanup = await getMediaCleanup(body.requestId).catch(() => ({ batchId: body.requestId, statusUnavailable: true })); }
  return { ...result, cleanup };
};
