import Return from "../models/Return.js";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { createNotification } from "../services/notification.service.js";

export const initiateReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // ✅ Validate reason
    if (typeof reason !== "string" || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    // ✅ Find order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 🔒 Only agent who placed order
    if (order.agentId !== req.user.agentId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this order",
      });
    }

    // 🔒 Only after delivered
    if (order.status !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Return can only be initiated after delivery",
      });
    }

    // ❌ Prevent duplicate return. A cancelled one does not count: it used to
    // block the order from ever being returned again.
    const existingReturn = await Return.findOne({
      orderId,
      status: { $ne: "CANCELLED" },
    });
    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: "Return already initiated for this order",
      });
    }

    // 🔍 Fetch latest agent data from DB
    const agent = await Agent.findById(req.user.id).select("name agentId role");

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // 🔥 Generate Return ID using counter
    const year = new Date().getFullYear();

    const counter = await Counter.findOneAndUpdate(
      { _id: `return-${year}` },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const serial = String(counter.seq).padStart(4, "0");
    const returnId = `RET${year}-${serial}`;

    // ✅ Create Return
    const newReturn = await Return.create({
      returnId,
      orderId,
      consumerId: order.consumerId,
      agentId: order.agentId,
      reason: reason.trim(),

      initiatedBy: {
        id: agent.agentId,
        name: agent.name,
        role: agent.role,
      },

      status: "INITIATED",

      statusHistory: [
        {
          status: "INITIATED",
          changedBy: {
            id: agent.agentId,
            name: agent.name,
            role: agent.role,
          },
          note: "Return initiated by agent",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Return initiated successfully",
      returnId: newReturn.returnId,
    });
  } catch (error) {
    console.error("INITIATE RETURN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate return",
    });
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

    const partner = await DeliveryPartner.findById(partnerId);

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

    // 🔥 FIX: the equivalent order-delivery assignment (assignDeliveryPartner
    // in order.controller.js) notifies the delivery partner of a new
    // assignment — this return-pickup assignment never did, so a partner
    // had no way to know a pickup was waiting for them unless they
    // happened to check the app.
    await createNotification({
      title: "New Return Pickup Assigned",
      message: `You have a new return pickup (${returnRequest.returnId}) assigned`,
      recipientId: partner._id,
      recipientModel: "DeliveryPartner",
      meta: {
        returnId: returnRequest.returnId,
      },
    });

    await returnRequest.save();

    return res.json({
      success: true,
      message: "Return pickup assigned successfully",
    });
  } catch (error) {
    console.error("ASSIGN RETURN PICKUP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign return pickup",
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

    // 3️⃣ Fetch all related orders in ONE query
    const orders = await Order.find({
      orderId: { $in: orderIds },
    }).lean();

    // 4️⃣ Convert orders to map for fast lookup
    const orderMap = {};
    orders.forEach((order) => {
      orderMap[order.orderId] = order;
    });

    // 5️⃣ Attach order details to return response
    const enrichedReturns = returns.map((ret) => {
      const order = orderMap[ret.orderId];

      return {
        ...ret.toObject(),

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

        items: order ? order.products : [],

        payment: order
          ? {
              totalAmount: order.totalAmount,
              paidAmount: order.paidAmount,
              dueAmount: order.dueAmount,
              paymentMode: order.paymentMode,
            }
          : null,

        refundStatus: {
          amount: ret.refund?.amount || 0,
          status: ret.status === "REFUND_PROCESSED" ? "PROCESSED" : "PENDING",
          method: ret.refund?.method || null,
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

    const returns = await Return.find({ agentId }).sort({ createdAt: -1 });

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
        ? req.body.reason
        : "Cancelled by agent";

    const returnRequest = await Return.findOne({ returnId });

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    // Ensure the agent owns this return
    if (returnRequest.agentId !== req.user.agentId) {
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
