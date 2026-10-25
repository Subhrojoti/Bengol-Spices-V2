import Order from "../models/Order.js";
import Return from "../models/Return.js";
import Agent from "../models/Agent.js";
import { agentMaySignIn } from "../utils/agentAccess.js";
import { withLock } from "./payment.service.js";

export const withStoreLocks = async (consumerIds, fn) => {
  const ids = [...new Set(consumerIds)].sort();
  const acquire = async (index) => {
    if (index === ids.length) return fn();
    // Allow time to acquire a batch over a remote DB, then commit its transaction.
    const locked = await withLock(`store-management:${ids[index]}`, () => acquire(index + 1), { leaseMs: 10 * 60 * 1000 });
    if (locked.busy) throw Object.assign(new Error("A store is being updated. Please retry shortly."), { status: 409 });
    return locked.value;
  };
  return acquire(0);
};

// Covers upload + creation + target updates, so a late store creation cannot
// race a complete account cleanup after its protected request was admitted.
export const agentStoreCreation = async (req, res, next) => {
  try {
    const locked = await withLock(`agent-management:${req.user.agentId}`, async () => {
      const agent = await Agent.findOne({ agentId: req.user.agentId }).select("status accessStatus").lean();
      if (!agentMaySignIn(agent)) return res.status(403).json({ success: false, message: "Agent access is not active" });
      await new Promise((resolve) => {
        const done = () => { res.off("finish", done); res.off("close", done); resolve(); };
        res.once("finish", done); res.once("close", done);
        next();
      });
    }, { leaseMs: 10 * 60 * 1000 });
    if (locked.busy) res.status(409).json({ success: false, message: "This agent is being updated. Retry shortly." });
  } catch (error) { next(error); }
};

// Shares locks with transfer/removal, including pay-first handlers that call placeOrder internally.
export const storeOperation = (handler) => async (req, res, next) => {
  try {
    let consumerId;
    const orderId = req.params?.orderId || req.body?.orderId;
    if (typeof orderId === "string") {
      consumerId = (await Order.findOne({ orderId }).select("consumerId").lean())?.consumerId;
    } else if (req.params?.returnId) {
      consumerId = (await Return.findOne({ returnId: req.params.returnId }).select("consumerId").lean())?.consumerId;
    } else consumerId = req.body?.orderPayload?.consumerId || req.body?.consumerId;
    if (typeof consumerId !== "string") return handler(req, res, next);
    return await withStoreLocks([consumerId], () => handler(req, res, next));
  } catch (error) { next(error); }
};
