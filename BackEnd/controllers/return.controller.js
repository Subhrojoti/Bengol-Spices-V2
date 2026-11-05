import Return from "../models/Return.js";
import { availableReturnItems, selectReturnItems, goodsOnly } from "../services/returnItems.service.js";
import { publish } from "../services/liveEvents.js";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { guardPartnerAssignment } from "../services/deliveryPartnerActivity.service.js";
import { createNotification } from "../services/notification.service.js";
import { withLock } from "../services/payment.service.js";
import mongoose from "mongoose";
import { managesStore, historyConsumerIds } from "../services/storeAccess.service.js";

// The agent app's own box takes 500 characters; nothing took any limit here
const REASON_MAX = 1000;

const returnActor = async (order, user) => {
  if (user.role === "AGENT") {
    if (!(await managesStore(order.consumerId, user.agentId))) throw Object.assign(new Error("Not authorized for this order"), { status: 403 });
    const agent = await Agent.findById(user.id).select("name agentId role").lean();
    if (!agent) throw Object.assign(new Error("Agent not found"), { status: 404 });
    return { id: agent.agentId, name: agent.name, role: "AGENT" };
  }
  if (user.role === "DELIVERY_PARTNER" && String(order.delivery?.partnerId) === String(user.id)) {
    const partner = await DeliveryPartner.findById(user.id).select("name status").lean();
    if (partner?.status === "ACTIVE") return { id: String(partner._id), name: partner.name, role: "DELIVERY_PARTNER" };
  }
  throw Object.assign(new Error("Not authorized for this order"), { status: 403 });
};
const assertReturnStage = (order, user) => {
  if (user.role === "AGENT" && order.status !== "DELIVERED") throw Object.assign(new Error("For a PLACED order, use Edit order to remove products. Return requests are available after delivery."), { status: 400 });
  if (user.role === "DELIVERY_PARTNER" && order.status !== "OUT_FOR_DELIVERY") throw Object.assign(new Error("Items can be returned at delivery only while the order is Out for delivery"), { status: 400 });
};

export const getReturnOptions = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    await returnActor(order, req.user);
    assertReturnStage(order, req.user);
    return res.json({ success: true, orderId: order.orderId, items: await availableReturnItems(order) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load returnable items" });
  }
};

export const initiateReturn = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { orderId } = req.params;
    const { reason, items, requestId } = req.body || {};
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > REASON_MAX) return res.status(400).json({ success: false, message: "A return reason of 1 to 1000 characters is required" });
    if (requestId !== undefined && (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(requestId))) return res.status(400).json({ success: false, message: "Invalid return request reference" });
    if (req.user.role === "DELIVERY_PARTNER" && (!Array.isArray(items) || !requestId)) return res.status(400).json({ success: false, message: "Select the items to return and provide a request reference" });

    const locked = await withLock("return:" + orderId, async () => {
      // Store-operation lock serializes delivery, reassignment and cleanup.
      return mongoose.connection.transaction(async session => {
        const order = await Order.findOne({ orderId }).session(session).lean();
        if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
        const actor = await returnActor(order, req.user);
        if (requestId) {
          const previous = await Return.findOne({ orderId, clientRequestId: requestId }).session(session).lean();
          if (previous) {
            const previousSelection = (previous.items || []).map(line => [line.lineIndex, line.quantity]).sort((a, b) => a[0] - b[0]);
            const nextSelection = items === undefined ? order.products.map((line, index) => [index, line.quantity]) : Array.isArray(items) ? items.map(line => [line?.lineIndex, line?.quantity]).sort((a, b) => a[0] - b[0]) : null;
            if (previous.initiatedBy?.id !== actor.id || previous.initiatedBy?.role !== actor.role || previous.reason !== reason.trim() || JSON.stringify(previousSelection) !== JSON.stringify(nextSelection)) throw Object.assign(new Error("This reference was used for different return details. Refresh before trying again."), { status: 409 });
            return { returnId: previous.returnId, alreadyCreated: true };
          }
        }
        assertReturnStage(order, req.user);
        // Preserve installed clients' full-order request contract.
        if (items === undefined && await Return.exists({ orderId, status: { $ne: "CANCELLED" } }).session(session)) throw Object.assign(new Error("Return already initiated for this order"), { status: 400 });
        const available = await availableReturnItems(order, session);
        const selected = selectReturnItems(order, available, items);
        const atDelivery = actor.role === "DELIVERY_PARTNER";
        if (atDelivery) await guardPartnerAssignment(req.user.id, session);
        const year = new Date().getFullYear();
        const counter = await Counter.findOneAndUpdate({ _id: "return-" + year }, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
        const returnId = "RET" + year + "-" + String(counter.seq).padStart(4, "0");
        const now = new Date();
        await Return.create([{
          returnId, orderId, consumerId: order.consumerId, agentId: order.agentId,
          reason: reason.trim(), items: selected, accountingPolicy: "OFFICE_REVIEW",
          source: atDelivery ? "AT_DELIVERY" : "AGENT", initiatedBy: actor,
          ...(requestId && { clientRequestId: requestId }),
          status: atDelivery ? "PICKED_UP" : "INITIATED",
          ...(atDelivery && { pickup: { partnerId: req.user.id, assignedAt: now, pickedUpAt: now } }),
          statusHistory: [
            { status: "INITIATED", changedBy: actor, note: "Selected items recorded; financial adjustments await office review" },
            ...(atDelivery ? [{ status: "PICKED_UP", changedBy: actor, note: "Selected items taken back during delivery" }] : []),
          ],
        }], { session });
        return { returnId, alreadyCreated: false };
      });
    });
    if (locked.busy) return res.status(409).json({ success: false, message: "A return is being recorded. Retry with the same request reference." });
    if (!locked.value.alreadyCreated) publish("RETURN_INITIATED", { orderId, returnId: locked.value.returnId }, "canAssignReturn");
    return res.status(201).json({ success: true, message: "Return recorded; amounts remain unchanged pending office review", ...locked.value });
  } catch (error) {
    if (!error.status) console.error("INITIATE RETURN ERROR:", error);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to initiate return. Retry with the same request reference." });
  }
};

// Assign Return to Delivery Partner

export const assignReturnPickup = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Delivery partner ID is required",
      });
    }

    const returnRequest = await Return.findOne({ returnId });

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    // Only INITIATED returns can be assigned
    if (returnRequest.status !== "INITIATED") {
      return res.status(400).json({
        success: false,
        message: "Return cannot be assigned at this stage",
      });
    }

    // A malformed id used to reach the database and answer 500
    const partner = mongoose.isValidObjectId(partnerId)
      ? await DeliveryPartner.findById(partnerId)
      : null;

    if (!partner || partner.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive delivery partner",
      });
    }

    // 🔥 Assign Pickup
    returnRequest.pickup = {
      partnerId: partner._id,
      assignedAt: new Date(),
    };

    returnRequest.status = "PICKUP_ASSIGNED";

    returnRequest.statusHistory.push({
      status: "PICKUP_ASSIGNED",
      changedBy: {
        id: req.user.employeeId || req.user.id,
        name: req.user.name || "Admin/Employee",
        role: req.user.role,
      },
      note: `Pickup assigned to ${partner.name}`,
    });

    await mongoose.connection.transaction(async session => {
      await guardPartnerAssignment(partner._id, session);
      const assigned = await Return.updateOne({ _id: returnRequest._id, status: "INITIATED" }, { $set: { pickup: returnRequest.pickup, status: "PICKUP_ASSIGNED" }, $push: { statusHistory: returnRequest.statusHistory[returnRequest.statusHistory.length - 1] } }, { session });
      if (!assigned.matchedCount) throw Object.assign(new Error("This return changed. Refresh before assigning it again."), { status: 409 });
    });

    /* The partner is told only once the assignment is saved, and a
       notification that cannot be written no longer fails the assignment.
       It used to go out first: a failed save still told the partner about a
       pickup that was not theirs, and a failed notification refused an
       assignment that was otherwise fine. Same order as assigning a
       delivery (assignDeliveryPartner in order.controller.js). */
    await createNotification({
      title: "New Return Pickup Assigned",
      message: `You have a new return pickup (${returnRequest.returnId}) assigned`,
      recipientId: partner._id,
      recipientModel: "DeliveryPartner",
      meta: {
        returnId: returnRequest.returnId,
      },
    }).catch((notifyError) =>
      console.error("RETURN PICKUP NOTIFICATION FAILED:", notifyError),
    );

    return res.json({
      success: true,
      message: "Return pickup assigned successfully",
    });
  } catch (error) {
    console.error("ASSIGN RETURN PICKUP ERROR:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to assign return pickup",
    });
  }
};

// Get Assigned Pickups for Delivery Partner
export const getAssignedReturns = async (req, res) => {
  try {
    const partnerId = req.user.id;

    // 1️⃣ Fetch assigned returns
    const returns = await Return.find({
      "pickup.partnerId": partnerId,
      status: {
        $in: ["PICKUP_ASSIGNED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE"],
      },
    }).sort({ createdAt: -1 });

    // 2️⃣ Collect orderIds
    const orderIds = returns.map((r) => r.orderId);

    // 3️⃣ Fetch all related orders in ONE query. Only where to go and what
    // to collect: a partner is sent nothing about money (see below).
    const orders = await Order.find({
      orderId: { $in: orderIds },
    })
      .select(
        "orderId deliveryAddress orderLocation products._id products.name products.quantity products.uom products.image",
      )
      .lean();

    // 4️⃣ Convert orders to map for fast lookup
    const orderMap = {};
    orders.forEach((order) => {
      orderMap[order.orderId] = order;
    });

    // 5️⃣ Attach order details to return response
    const enrichedReturns = returns.map((ret) => {
      const order = orderMap[ret.orderId];

      // The refund (how much, by what method) is the office's business
      const { refund: _refund, items: selectedItems, ...details } = ret.toObject();

      return {
        ...details,

        storeDetails: order
          ? {
              storeName: order.deliveryAddress?.storeName,
              ownerName: order.deliveryAddress?.ownerName,
              phone: order.deliveryAddress?.phone,
            }
          : null,

        pickupLocation: order
          ? {
              latitude: order.orderLocation?.latitude,
              longitude: order.orderLocation?.longitude,
              address: `${order.deliveryAddress?.street}, ${order.deliveryAddress?.city}, ${order.deliveryAddress?.state} - ${order.deliveryAddress?.pincode}`,
            }
          : null,

        items: selectedItems?.length ? selectedItems.map(goodsOnly) : order ? order.products : [],

        /* The order's value, what was paid and owed, and the refund amount
           and method used to be sent here. A partner collecting a return
           handles goods, not money, so they no longer are. */
        refundStatus: {
          status: ret.status === "REFUND_PROCESSED" ? "PROCESSED" : "PENDING",
        },
      };
    });

    return res.json({
      success: true,
      count: enrichedReturns.length,
      data: enrichedReturns,
    });
  } catch (error) {
    console.error("GET ASSIGNED RETURNS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned returns",
    });
  }
};

//Get All Active Returns (Admin / Employee)
export const getActiveReturns = async (req, res) => {
  try {
    const returns = await Return.find({
      status: {
        $in: [
          "INITIATED",
          "PICKUP_ASSIGNED",
          "PICKED_UP",
          "RECEIVED_AT_WAREHOUSE",
        ],
      },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: returns.length,
      returns,
    });
  } catch (error) {
    console.error("GET ACTIVE RETURNS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active returns",
    });
  }
};

//Update Return Status by Delivery Partner
export const updateReturnStatus = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status } = req.body;

    const returnRequest = await Return.findOne({ returnId });

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    // Must be assigned to this partner
    if (
      !returnRequest.pickup?.partnerId ||
      returnRequest.pickup.partnerId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this return",
      });
    }

    if (["COMPLETED", "CANCELLED"].includes(returnRequest.status)) {
      return res.status(400).json({
        success: false,
        message: "Return already finalized",
      });
    }

    // Strict transition rules
    const allowedTransitions = {
      PICKUP_ASSIGNED: "PICKED_UP",
      PICKED_UP: "RECEIVED_AT_WAREHOUSE",
      RECEIVED_AT_WAREHOUSE: "COMPLETED",
    };

    if (allowedTransitions[returnRequest.status] !== status) {
      return res.status(400).json({
        success: false,
        message: "Invalid return status transition",
      });
    }

    // 🔥 Update timestamps
    if (status === "PICKED_UP") {
      returnRequest.pickup.pickedUpAt = new Date();
    }

    returnRequest.status = status;

    returnRequest.statusHistory.push({
      status,
      changedBy: {
        id: req.user.id,
        name: req.user.name || "Delivery Partner",
        role: req.user.role,
      },
      note: `Status updated to ${status}`,
    });

    await returnRequest.save();

    return res.json({
      success: true,
      message: "Return status updated successfully",
    });
  } catch (error) {
    console.error("UPDATE RETURN STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update return status",
    });
  }
};

// Get My Returns (Agent)
export const getMyReturns = async (req, res) => {
  try {
    const agentId = req.user.agentId;

    const returns = await Return.find({ consumerId: { $in: await historyConsumerIds(agentId) } }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: returns.length,
      data: returns,
    });
  } catch (error) {
    console.error("GET MY RETURNS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch returns",
    });
  }
};

// Cancel Return (Agent)
export const cancelReturn = async (req, res) => {
  try {
    const { returnId } = req.params;

    // 🔥 FIX: the agent app's Cancel button sends no reason (and, in builds
    // already installed, no body at all, which Express 5 leaves undefined).
    // Destructuring that threw, and a missing reason was refused, so no
    // agent could cancel a return. A reason is recorded when given.
    const reason =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, REASON_MAX)
        : "Cancelled by agent";

    const returnRequest = await Return.findOne({ returnId });

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    // Only the store's current active manager may cancel this return.
    if (!(await managesStore(returnRequest.consumerId, req.user.agentId))) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this return",
      });
    }

    // 🔥 FIX: req.user.name is never set in the agent JWT (only id,
    // agentId, role are) — so `req.user.name || "Agent"` always fell back
    // to the generic label. initiateReturn, in this same file, already
    // looks the name up from the DB; mirroring that here.
    const agent = await Agent.findById(req.user.id).select("name");
    const agentName = agent?.name || "Agent";

    if (returnRequest.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Return already cancelled",
      });
    }

    // Cannot cancel after pickup started. Listed as the states that CAN be
    // cancelled: REFUND_PROCESSED was missing from the old blocklist, so a
    // refunded return could still be cancelled.
    if (!["INITIATED", "PICKUP_ASSIGNED"].includes(returnRequest.status)) {
      return res.status(400).json({
        success: false,
        message: "Return cannot be cancelled after pickup",
      });
    }

    // Update status
    returnRequest.status = "CANCELLED";

    // Save cancellation details
    returnRequest.cancellation = {
      reason: reason.trim(),
      cancelledAt: new Date(),
      cancelledBy: {
        id: req.user.agentId,
        name: agentName,
        role: req.user.role,
      },
    };

    // Push status history
    returnRequest.statusHistory.push({
      status: "CANCELLED",
      changedBy: {
        id: req.user.agentId,
        name: agentName,
        role: req.user.role,
      },
      note: reason,
    });

    await returnRequest.save();

    return res.json({
      success: true,
      message: "Return cancelled successfully",
    });
  } catch (error) {
    console.error("CANCEL RETURN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel return",
    });
  }
};

// Get All Returns (Admin / Employee with permission)
export const getAllReturns = async (req, res) => {
  try {
    const returns = await Return.find()
      .populate("pickup.partnerId", "name phone")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: returns.length,
      data: returns,
    });
  } catch (error) {
    console.error("GET ALL RETURNS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch returns",
    });
  }
};
