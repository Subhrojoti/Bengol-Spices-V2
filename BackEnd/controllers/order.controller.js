import crypto from "crypto";
import Counter from "../models/Counter.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Employee from "../models/Employee.js";
import Admin from "../models/Admin.js";
import Order from "../models/Order.js";
import Store from "../models/store.js";
import Product from "../models/Product.js";
import Invoice from "../models/Invoice.js";
import {
  createInvoiceFromOrder,
  regenerateInvoicePDF,
  updateInvoiceAfterPayment,
} from "../services/invoice.service.js";
import { createShiprocketOrder } from "../services/shiprocket.service.js";
import Payment from "../models/Payment.js";
import { createNotification } from "../services/notification.service.js";
import { razorpayInstance } from "../config/razorpay.js";
import Agent from "../models/Agent.js";
import { updateTargetProgress } from "../services/target.service.js";

/* =============================
   HELPER: Resolve tiered price based on store type
   Returns the correct price for a product given the store's category.
   Falls back to item.unitPrice if no tiered price is set (backward safe).
   ============================= */
const resolvePrice = (productDoc, storeType, fallbackUnitPrice) => {
  if (!productDoc) return fallbackUnitPrice;

  const priceMap = {
    RETAILER: productDoc.retailerPrice,
    WHOLESALER: productDoc.wholesalerPrice,
    DISTRIBUTOR: productDoc.distributorPrice,
  };

  const tieredPrice = priceMap[storeType];

  // ✅ Only use tiered price if it's set and valid (> 0)
  // Otherwise fall back to what agent passed as unitPrice
  if (tieredPrice !== null && tieredPrice !== undefined && tieredPrice > 0) {
    return tieredPrice;
  }

  return fallbackUnitPrice;
};

// PLACE ORDER (AGENT)
export const placeOrder = async (req, res) => {
  try {
    const {
      consumerId,
      products,
      paidAmount,
      paymentMode,
      // 🔥 FIX: no longer read latitude/longitude from the order request.
      // Delivery location must always be the store's own registered
      // coordinates (captured once, accurately, at store creation) —
      // see below where orderLocation is set from store.location.
      // Razorpay reference — only present when this order is placed via
      // the "pay first, then place order" flow (verifyPaymentAndPlaceOrder).
      // Captured here so it can be attached to the Payment record created
      // below, instead of a second, separate Payment record being created
      // afterwards for the same transaction.
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const agentId = req.user?.agentId;

    /* =============================
       BASIC VALIDATION
       ============================= */

    if (
      !consumerId ||
      !Array.isArray(products) ||
      products.length === 0 ||
      paidAmount === undefined ||
      !paymentMode
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Agent identity missing",
      });
    }

    /* =============================
       STORE VALIDATION + OWNERSHIP
       ============================= */

    const store = await Store.findOne({
      consumerId,
      registeredBy: agentId,
    });

    if (!store) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to place order for this store or the store does not exist",
      });
    }

    // ✅ Capture storeType for price resolution below
    const storeType = store.storeType; // "RETAILER" | "WHOLESALER" | "DISTRIBUTOR"

    /* =============================
       PRODUCT VALIDATION & AMOUNT
       ============================= */

    let totalAmount = 0;

    for (const item of products) {
      // BASIC VALIDATION
      if (
        !item.name ||
        !item.uom ||
        !item.quantity ||
        !item.unitPrice ||
        item.quantity <= 0 ||
        item.unitPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product details",
        });
      }

      /* =============================
         AUTO FETCH PRODUCT (SAFE)
         ============================= */

      let productDoc = null;

      if (item.productId) {
        productDoc = await Product.findById(item.productId);
      } else {
        productDoc = await Product.findOne({
          name: item.name,
          status: "ACTIVE",
        });
      }

      /* =============================
         ENRICH DATA + RESOLVE TIERED PRICE
         ============================= */

      if (productDoc) {
        item.productId = productDoc._id;
        item.name = productDoc.name;
        item.image = productDoc.images?.front?.url;
        item.gstPercentage = productDoc.gstPercentage || 0;

        // ✅ NEW: Auto-resolve correct price based on store type
        // If tiered price exists for this storeType → use it
        // If not → keep item.unitPrice as sent by agent (backward safe)
        item.unitPrice = resolvePrice(productDoc, storeType, item.unitPrice);
      }

      /* =============================
         CALCULATE TOTAL
         ============================= */

      item.totalPrice = item.quantity * item.unitPrice;
      totalAmount += item.totalPrice;
    }

    if (paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Invalid paid amount",
      });
    }

    const dueAmount = totalAmount - paidAmount;

    /* =============================
       SAFE ORDER ID GENERATION
       ============================= */

    const currentYear = new Date().getFullYear();

    const counter = await Counter.findByIdAndUpdate(
      `order_${currentYear}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const serial = String(counter.seq).padStart(4, "0");
    const orderId = `ORD${currentYear}-${serial}`;

    /* =============================
       DUE DATE (7 DAYS)
       ============================= */

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    /* =============================
       CREATE ORDER
       ============================= */

    const order = await Order.create({
      orderId,
      consumerId,
      store: store._id,
      agentId,
      products,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentMode,
      dueDate,
      orderLocation: {
        // 🔥 FIX: this is the bug behind delivery partners being sent to
        // the wrong place. It used to be whatever latitude/longitude the
        // agent's device happened to send when SUBMITTING the order form —
        // which could be the agent's home, office, or anywhere else they
        // were standing, not necessarily the store. The store's own
        // location was already captured once, accurately, at store
        // creation — that's the only coordinate that should ever be used
        // for delivery navigation.
        latitude: store.location.latitude,
        longitude: store.location.longitude,
      },
      deliveryAddress: {
        storeName: store.storeName,
        ownerName: store.ownerName,
        phone: store.phone,
        state: store.address.state,
        city: store.address.city,
        street: store.address.street,
        pincode: store.address.pincode,
      },
      status: "PLACED",
      statusHistory: [
        {
          status: "PLACED",
          changedBy: {
            id: agentId,
            role: "AGENT",
          },
        },
      ],
      paymentStatus: dueAmount === 0 ? "COMPLETED" : "PENDING",
    });

    // ✅ Create payment entry for CASH / initial payment
    if (paidAmount > 0) {
      await Payment.create({
        orderId: order.orderId,
        consumerId: order.consumerId,
        agentId: order.agentId,
        amount: paidAmount,
        method: paymentMode === "ONLINE" ? "RAZORPAY" : "CASH",
        // 🔥 FIX: attach the verified Razorpay reference here (when this
        // is an online initial payment) so verifyPaymentAndPlaceOrder no
        // longer needs to create a second, duplicate Payment record for
        // this exact same transaction.
        ...(razorpay_order_id && { razorpayOrderId: razorpay_order_id }),
        ...(razorpay_payment_id && { razorpayPaymentId: razorpay_payment_id }),
        ...(razorpay_signature && { razorpaySignature: razorpay_signature }),
        collectedBy: {
          id: agentId,
          role: "AGENT",
        },
      });
    }

    /* =============================
       Auto Invoice Generation
       ============================= */

    await createInvoiceFromOrder(order);

    /* =============================
       TARGET + COMMISSION + NOTIFICATION
       ============================= */

    await updateTargetProgress({
      agentId,
      type: "ORDER",
      order,
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: order.orderId,
    });
  } catch (error) {
    console.error("PLACE ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
//GET STOREWISE ORDERS
export const getOrdersByStoreConsumerId = async (req, res) => {
  try {
    const { consumerId } = req.params;
    const user = req.user;

    if (!consumerId) {
      return res.status(400).json({
        success: false,
        message: "Consumer ID is required",
      });
    }

    // 🔐 AGENT ACCESS CONTROL
    // Agent can only see orders of stores created by himself
    if (user.role === "AGENT") {
      const orders = await Order.find({
        consumerId,
        agentId: user.agentId, // IMPORTANT
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        totalOrders: orders.length,
        orders,
      });
    }

    // 🔐 ADMIN & EMPLOYEE ACCESS
    if (user.role === "ADMIN" || user.role === "EMPLOYEE") {
      const orders = await Order.find({ consumerId }).sort({
        createdAt: -1,
      });

      return res.json({
        success: true,
        totalOrders: orders.length,
        orders,
      });
    }

    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  } catch (error) {
    console.error("STORE WISE ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store orders",
    });
  }
};

// GET ORDERS PLACED BY LOGGED-IN AGENT
export const getMyOrders = async (req, res) => {
  try {
    const agentId = req.user.agentId;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Agent identity missing in token",
      });
    }

    const orders = await Order.find({ agentId }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("GET MY ORDERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

// GET ALL ORDERS (ADMIN / EMPLOYEE)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    // ✅ match using STRING orderId
    const orderIds = orders.map((order) => order.orderId);

    const invoices = await Invoice.find({
      orderId: { $in: orderIds },
    });

    const invoiceMap = {};
    invoices.forEach((inv) => {
      invoiceMap[inv.orderId] = inv;
    });

    const enrichedOrders = orders.map((order) => {
      const invoice = invoiceMap[order.orderId];

      return {
        ...order.toObject(),
        invoiceLink: invoice
          ? `${req.protocol}://${req.get("host")}/api/invoice/download/${order.orderId}`
          : null,
        invoiceNumber: invoice ? invoice.invoiceNumber : null,
      };
    });

    return res.json({
      success: true,
      count: enrichedOrders.length,
      orders: enrichedOrders,
    });
  } catch (error) {
    console.error("GET ALL ORDERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

//GET ALL ACTIVE ORDERS (For admin/employee)
export const getActiveOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      status: {
        $in: ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"],
      },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("GET ACTIVE ORDERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active orders",
    });
  }
};

// Confirm order (ADMIN)
export const confirmOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "PLACED") {
      return res.status(400).json({
        success: false,
        message: "Only PLACED orders can be confirmed",
      });
    }

    order.status = "CONFIRMED";

    order.statusHistory.push({
      status: "CONFIRMED",
      changedBy: {
        id: req.user.employeeId || req.user.id,
        role: req.user.role, // VERY IMPORTANT
      },
    });
    await order.save();

    res.json({
      success: true,
      message: "Order confirmed successfully",
    });
  } catch (error) {
    console.error("CONFIRM ORDER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm order",
    });
  }
};
// Cancel Order (ADMIN / EMPLOYEE)
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Delivered order cannot be cancelled",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    // 🔥 Determine who cancelled
    let cancelledById;
    let cancelledByName;
    let cancelledByRole = req.user.role;

    if (req.user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({
        employeeId: req.user.employeeId,
      });

      cancelledById = req.user.employeeId;
      cancelledByName = employee?.name || "Unknown Employee";
    } else if (req.user.role === "ADMIN") {
      const admin = await Admin.findById(req.user.id);

      cancelledById = req.user.id;
      cancelledByName = admin?.name || "Admin";
    }

    // 🔥 Update status
    order.status = "CANCELLED";

    order.cancellation = {
      reason: reason.trim(),
      cancelledAt: new Date(),
      cancelledBy: {
        id: cancelledById,
        name: cancelledByName,
        role: cancelledByRole,
      },
    };

    order.statusHistory.push({
      status: "CANCELLED",
      changedBy: {
        id: cancelledById,
        role: cancelledByRole,
      },
    });

    await order.save();

    return res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};
//Assign delivery partner (ADMIN / EMPLOYEE)
export const assignDeliveryPartner = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { partnerId } = req.body; // MongoDB _id

    // 🔥 FIX: was missing this check (assignReturnPickup, the equivalent
    // return-pickup flow, already has it). Without it, an omitted
    // partnerId means findById(undefined) → findOne({_id: undefined}) →
    // Mongoose drops the undefined key, which could match an arbitrary
    // DeliveryPartner document instead of correctly rejecting the request.
    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Delivery partner ID is required",
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "CONFIRMED" && order.status !== "ASSIGNED") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be assigned at this stage",
      });
    }

    const partner = await DeliveryPartner.findById(partnerId);

    if (!partner || partner.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found or inactive",
      });
    }
    // Check if already assigned to this partner
    if (order.delivery?.partnerId?.toString() === partnerId) {
      return res.status(400).json({
        success: false,
        message: "This partner is already assigned",
      });
    }

    // ✅ Assign delivery
    order.delivery = {
      partnerId: partner._id,
      assignedBy: req.user._id || req.user.id, // 🔥 FIXED (generic)
      assignedAt: new Date(),
    };

    order.status = "ASSIGNED";

    order.statusHistory.push({
      status: "ASSIGNED",
      changedBy: {
        id: req.user._id || req.user.id,
        role: req.user.role,
      },
    });

    // ✅ FIXED notification
    await createNotification({
      title: "New Order Assigned",
      message: `You have a new order (${order.orderId}) assigned`,
      recipientId: partner._id, // 🔥 FIXED
      recipientModel: "DeliveryPartner",
      meta: {
        orderId: order.orderId,
      },
    });

    await order.save();

    res.json({
      success: true,
      message: "Delivery partner assigned successfully",
    });
  } catch (error) {
    console.error("ASSIGN DELIVERY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign delivery partner",
    });
  }
};
// Update Delivery Status (DELIVERY PARTNER)
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Must be assigned to this delivery partner
    if (
      !order.delivery.partnerId ||
      order.delivery.partnerId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this order",
      });
    }

    const allowedTransitions = {
      ASSIGNED: "SHIPPED",
      SHIPPED: "OUT_FOR_DELIVERY",
      OUT_FOR_DELIVERY: "DELIVERED",
    };

    if (allowedTransitions[order.status] !== status) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition",
      });
    }

    order.status = status;

    order.statusHistory.push({
      status,
      changedBy: {
        id: req.user.id,
        role: req.user.role,
      },
    });

    await order.save();

    res.json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.error("UPDATE DELIVERY STATUS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
    });
  }
};

// Collect Payment (Future code mode --- Razorpay / Stripe)
export const collectPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, method, note } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.agentId !== req.user.agentId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to collect payment for this order",
      });
    }

    if (order.dueAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No due amount remaining",
      });
    }

    if (amount > order.dueAmount) {
      return res.status(400).json({
        success: false,
        message: "Amount exceeds due amount",
      });
    }

    await Payment.create({
      orderId: order.orderId,
      consumerId: order.consumerId,
      agentId: order.agentId,
      amount,
      method,
      note,
      collectedBy: {
        id: req.user.agentId,
        role: "AGENT",
      },
    });

    order.paidAmount += amount;
    order.dueAmount -= amount;

    if (order.dueAmount === 0) {
      order.paymentStatus = "COMPLETED";
    }

    await order.save();
    // Update invoice after payment
    await updateInvoiceAfterPayment({
      orderId: order.orderId,
      amount,
      method: method || "CASH",
    });

    await updateTargetProgress({
      agentId: req.user.agentId,
      type: "PAYMENT",
      value: 1,
      amount,
    });

    res.json({
      success: true,
      message: "Payment recorded successfully",
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,
    });
  } catch (error) {
    console.error("COLLECT PAYMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to collect payment",
    });
  }
};

// Payment history for an order (ADMIN / EMPLOYEE )
export const getOrderPayments = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payments = await Payment.find({ orderId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

// Agent Due Orders (Agent can see all their orders with due amount > 0)
export const getAgentDueOrders = async (req, res) => {
  try {
    const agentId = req.user.agentId;

    const orders = await Order.find({
      agentId,
      dueAmount: { $gt: 0 },
      status: { $ne: "CANCELLED" },
    }).sort({ dueDate: 1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch due orders",
    });
  }
};

// OverDue Orders (Admin / Employee can see all orders with due amount > 0 and past due date)
export const getCompletePaymentSummary = async (req, res) => {
  try {
    // 🔍 Filters from query params
    const { agentId, consumerId, paymentStatus, method, fromDate, toDate } =
      req.query;

    /* =============================
       BUILD ORDER FILTER
       ============================= */
    const orderFilter = {};

    if (agentId) orderFilter.agentId = agentId;
    if (consumerId) orderFilter.consumerId = consumerId;
    if (paymentStatus) orderFilter.paymentStatus = paymentStatus;

    // ❌ Exclude cancelled orders
    orderFilter.status = { $ne: "CANCELLED" };

    // 📅 Date filter (order created date)
    if (fromDate || toDate) {
      orderFilter.createdAt = {};
      if (fromDate) orderFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) orderFilter.createdAt.$lte = new Date(toDate);
    }

    /* =============================
       FETCH ORDERS
       ============================= */
    const orders = await Order.find(orderFilter).sort({ createdAt: -1 }).lean(); // 🚀 faster & safe

    const orderIds = orders.map((o) => o.orderId);

    // 🔥 Fetch Agent Details
    const agentIds = [...new Set(orders.map((o) => o.agentId))];

    const agents = await Agent.find({
      agentId: { $in: agentIds },
    }).lean();

    // Create lookup map
    const agentMap = {};
    agents.forEach((a) => {
      agentMap[a.agentId] = a;
    });

    /* =============================
       FETCH PAYMENTS
       ============================= */
    const paymentFilter = {
      orderId: { $in: orderIds },
    };

    if (method) paymentFilter.method = method;

    const payments = await Payment.find(paymentFilter).lean();

    /* =============================
       GROUP PAYMENTS BY ORDER
       ============================= */
    const paymentMap = {};

    payments.forEach((p) => {
      if (!paymentMap[p.orderId]) {
        paymentMap[p.orderId] = [];
      }
      paymentMap[p.orderId].push(p);
    });

    /* =============================
       BUILD FINAL RESPONSE
       ============================= */
    const summary = orders.map((order) => {
      const orderPayments = paymentMap[order.orderId] || [];

      const agent = agentMap[order.agentId];

      return {
        orderId: order.orderId,
        consumerId: order.consumerId,
        agentId: order.agentId,

        // 👇 NEW FIELD
        agent: {
          agentId: order.agentId,
          name: agent?.name || null,
          phone: agent?.phone || null,
        },

        totalAmount: order.totalAmount,
        // 🔥 FIX: use the Order document's own paidAmount/dueAmount — these
        // are the authoritative, atomically-maintained values (every place
        // that collects a payment updates them in the same step). Deriving
        // "paid" by summing the Payment collection instead could double-
        // count a transaction if a stray/duplicate Payment record ever
        // exists, showing an impossible negative "due" on a fully-paid
        // order even though the order itself is correct.
        paidAmount: order.paidAmount,
        dueAmount: order.dueAmount,

        paymentStatus: order.paymentStatus,
        orderStatus: order.status,

        dueDate: order.dueDate,
        createdAt: order.createdAt,

        store: order.deliveryAddress?.storeName,
        phone: order.deliveryAddress?.phone,
        city: order.deliveryAddress?.city,
        state: order.deliveryAddress?.state,

        payments: orderPayments.map((p) => ({
          amount: p.amount,
          method: p.method,
          collectedAt: p.createdAt,
          collectedBy: p.collectedBy?.id,
        })),
      };
    });

    /* =============================
       RESPONSE
       ============================= */
    res.json({
      success: true,
      count: summary.length,
      data: summary,
    });
  } catch (error) {
    console.error("Payment Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment summary",
    });
  }
};

// Agent Collection Performance (Admin / Employee with permission can see total collected amount by each agent in a date range)
export const getAgentCollectionPerformance = async (req, res) => {
  try {
    // 🔥 FIX: totalCollected now comes from each order's own paidAmount
    // (authoritative, atomically maintained on the Order document) instead
    // of summing the Payment collection directly. Summing Payment.amount
    // could double-count a transaction if a stray/duplicate Payment record
    // ever exists for an order (the exact bug just fixed in
    // verifyPaymentAndPlaceOrder), inflating an agent's collected total.
    const collected = await Order.aggregate([
      {
        $group: {
          _id: "$agentId",
          totalCollected: { $sum: "$paidAmount" },
        },
      },
    ]);

    // "transactions" is a genuine count of individual payment-collection
    // events, which only the Payment log actually records — kept as is.
    const transactionCounts = await Payment.aggregate([
      {
        $group: {
          _id: "$agentId",
          transactions: { $sum: 1 },
        },
      },
    ]);

    const transactionMap = {};
    transactionCounts.forEach((t) => {
      transactionMap[t._id] = t.transactions;
    });

    const performance = collected.map((c) => ({
      _id: c._id,
      totalCollected: c.totalCollected,
      transactions: transactionMap[c._id] || 0,
    }));

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load performance",
    });
  }
};

// CREATE SHIPMENT (DUMMY VERSION)
export const createShipment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.shipment && order.shipment.status) {
      return res.status(400).json({
        success: false,
        message: "Shipment already created",
      });
    }

    // 🔥 Call service (dummy for now)
    const shipmentData = await createShiprocketOrder(order);

    order.shipment = {
      ...shipmentData,
      createdAt: new Date(),
    };

    order.status = "SHIPPED";
    await order.save();

    return res.json({
      success: true,
      message: "Shipment created successfully",
    });
  } catch (error) {
    console.error("CREATE SHIPMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create shipment",
    });
  }
};

// Create Razorpay Order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.dueAmount <= 0) {
      return res.status(400).json({ message: "No due amount left" });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: order.dueAmount * 100,
      currency: "INR",
      receipt: order.orderId,
    });

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id, // ✅ used in frontend
      amount: razorpayOrder.amount, // ✅ used in frontend
      key: process.env.RAZORPAY_KEY_ID, // ✅ REQUIRED for checkout
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Razorpay order failed" });
  }
};

// Verify Razorpay Payment
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      amount,
    } = req.body;

    // ✅ Ensure number
    const numericAmount = Number(amount);

    // 🔐 Verify Signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET) // ✅ FIXED
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // 🔍 Idempotency check
    const existing = await Payment.findOne({
      razorpayPaymentId: razorpay_payment_id,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Payment already processed",
      });
    }

    // 🔍 Fetch order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Correct unit comparison (paise vs rupees)
    if (numericAmount > order.dueAmount * 100) {
      return res.status(400).json({
        message: "Amount exceeds due",
      });
    }

    // ✅ Save payment
    await Payment.create({
      orderId: order.orderId,
      consumerId: order.consumerId,
      agentId: order.agentId,
      amount: numericAmount / 100, // store in rupees
      method: "RAZORPAY",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      collectedBy: {
        id: order.agentId,
        role: "AGENT",
      },
    });

    // ✅ Update order
    const paidAmountInRupees = numericAmount / 100;

    order.paidAmount += paidAmountInRupees;
    order.dueAmount -= paidAmountInRupees;

    if (order.dueAmount === 0) {
      order.paymentStatus = "COMPLETED";
    }

    await order.save();

    // ✅ UPDATE INVOICE AFTER PAYMENT
    const invoice = await Invoice.findOne({ orderId });

    if (invoice) {
      const paid = numericAmount / 100;

      invoice.paidAmount += paid;
      invoice.dueAmount -= paid;

      invoice.payments.push({
        amount: paid,
        method: "RAZORPAY",
        paymentId: razorpay_payment_id,
      });

      invoice.status = invoice.dueAmount === 0 ? "PAID" : "PARTIAL";

      await invoice.save();

      // 🔥 OPTIONAL: regenerate PDF
      await regenerateInvoicePDF(invoice);
    }

    await updateTargetProgress({
      agentId: order.agentId,
      type: "PAYMENT",
      value: 1,
    });

    res.json({
      success: true,
      message: "Payment successful",
    });
  } catch (error) {
    console.error("RAZORPAY VERIFY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

// Initial Payment Razorpayment during placing order
export const createOrderPayment = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum amount should be ₹1",
      });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order_${Date.now()}`,
    });

    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("CREATE ORDER PAYMENT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
};

// Verify initial payment for order placement
export const verifyPaymentAndPlaceOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      orderPayload, // 👈 full order body (same as placeOrder)
    } = req.body;

    const numericAmount = Number(amount);

    /* =============================
       🔐 VERIFY SIGNATURE
       ============================= */

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    /* =============================
       🔁 DUPLICATE CHECK
       ============================= */

    const existing = await Payment.findOne({
      razorpayPaymentId: razorpay_payment_id,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Payment already processed",
      });
    }

    /* =============================
       🧠 USE YOUR EXISTING LOGIC
       ============================= */

    req.body = {
      ...orderPayload,
      paidAmount: numericAmount / 100, // ✅ override safely
      paymentMode:
        numericAmount / 100 === orderPayload.totalAmount ? "ONLINE" : "MIXED",
      // 🔥 FIX: pass the verified Razorpay reference through so placeOrder
      // attaches it to the ONE Payment record it creates, instead of a
      // second duplicate Payment record being made below for the same
      // transaction. That duplicate was inflating "total paid" everywhere
      // payments get summed (e.g. the admin Payment Info screen), even
      // though order.paidAmount itself stayed correct — which is exactly
      // why the admin view and the agent's own view disagreed.
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    };

    // ⚡ Call your existing controller
    const response = await new Promise((resolve) => {
      placeOrder(req, {
        status: (code) => ({
          json: (data) => resolve({ code, data }),
        }),
      });
    });

    // ✅ CREATE INVOICE AFTER ORDER CREATED
    const order = await Order.findOne({ orderId: response.data.orderId });

    if (order) {
      await createInvoiceFromOrder(order); // 👈 helper function (clean code)
    }

    if (!response.data.success) {
      return res.status(400).json(response.data);
    }

    // 🔥 FIX: removed the duplicate Payment.create that used to run here.
    // placeOrder (called above) already created the Payment record for
    // this exact amount — now carrying the Razorpay reference too — so
    // creating a second one here was double-counting this single
    // transaction wherever payments get summed.

    await updateTargetProgress({
      agentId: order.agentId,
      type: "PAYMENT",
      value: 1,
    });

    return res.json({
      success: true,
      message: "Order placed with payment",
      orderId: response.data.orderId,
    });
  } catch (error) {
    console.error("VERIFY + PLACE ORDER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Order placement failed",
    });
  }
};
/* ============================================================
   QR CODE PAYMENTS (Razorpay Dynamic UPI QR)
   ============================================================
   Three-step pattern, mirroring your existing online-payment flow:
     1. create-*-qr      -> generates a Razorpay QR code, returns image_url
     2. qr-status/:id     -> app polls this while the QR is on screen
     3. verify-*-qr       -> called once by the app when polling reports
                             paid=true; re-confirms server-side against
                             Razorpay directly (not trusting the poll
                             response alone) before applying the payment.
   ============================================================ */

// Helper: 20 minutes from now, in unix seconds (Razorpay requires close_by
// to be at least 15 minutes out).
function qrExpiryTimestamp() {
  return Math.floor(Date.now() / 1000) + 20 * 60;
}

/* STEP 1a - CREATE QR FOR A NEW ORDER (initial payment) */
export const createInitialPaymentQr = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid amount is required",
      });
    }

    const qrCode = await razorpayInstance.qrCode.create({
      type: "upi_qr",
      name: "Bengol Spices Order Payment",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: Math.round(amount * 100), // rupees -> paise
      description: "Order payment",
      close_by: qrExpiryTimestamp(),
      notes: {
        purpose: "order_initial_payment",
        agentId: req.user.agentId,
      },
    });

    return res.status(200).json({
      success: true,
      qrCodeId: qrCode.id,
      imageUrl: qrCode.image_url,
      amount,
    });
  } catch (error) {
    console.error("CREATE INITIAL QR ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
    });
  }
};

/* STEP 1b - CREATE QR FOR COLLECTING A DUE AMOUNT */
/* Always the FULL remaining due — no partial amount accepted from the app. */
export const createDuePaymentQr = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.dueAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "This order has no due amount" });
    }

    const qrCode = await razorpayInstance.qrCode.create({
      type: "upi_qr",
      name: `Due Payment - ${order.orderId}`,
      usage: "single_use",
      fixed_amount: true,
      payment_amount: Math.round(order.dueAmount * 100), // full due, in paise
      description: `Remaining balance for order ${order.orderId}`,
      close_by: qrExpiryTimestamp(),
      notes: {
        purpose: "order_due_payment",
        orderId: order.orderId,
        agentId: req.user.agentId,
      },
    });

    return res.status(200).json({
      success: true,
      qrCodeId: qrCode.id,
      imageUrl: qrCode.image_url,
      amount: order.dueAmount,
    });
  } catch (error) {
    console.error("CREATE DUE QR ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
    });
  }
};

/* STEP 2 - POLL QR PAYMENT STATUS (shared by both flows) */
export const checkQrPaymentStatus = async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    const qrCode = await razorpayInstance.qrCode.fetch(qrCodeId);

    const paid =
      qrCode.status === "closed" &&
      qrCode.close_reason === "paid" &&
      qrCode.payments_amount_received >= qrCode.payment_amount;

    return res.status(200).json({
      success: true,
      paid,
      status: qrCode.status,
      amountReceived: qrCode.payments_amount_received / 100,
    });
  } catch (error) {
    console.error("CHECK QR STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check QR payment status",
    });
  }
};

/* STEP 3a - VERIFY QR PAID + PLACE THE ORDER (mirrors verifyInitialPaymentAndPlaceOrder) */
export const verifyQrAndPlaceOrder = async (req, res) => {
  try {
    const { qrCodeId, amount, orderPayload } = req.body;

    // Re-fetch directly from Razorpay — never trust a client-reported "paid" flag.
    const qrCode = await razorpayInstance.qrCode.fetch(qrCodeId);
    const paid =
      qrCode.status === "closed" &&
      qrCode.close_reason === "paid" &&
      qrCode.payments_amount_received >= qrCode.payment_amount;

    if (!paid) {
      return res.status(400).json({
        success: false,
        message: "This QR code has not been paid yet",
      });
    }

    const payments = await razorpayInstance.qrCode.fetchAllPayments(qrCodeId);
    const razorpayPaymentId = payments.items?.[0]?.id ?? null;

    req.body = {
      ...orderPayload,
      paymentMode: "QR",
      paidAmount: amount,
      razorpayOrderId: qrCodeId,
      razorpayPaymentId,
    };

    return placeOrder(req, res);
  } catch (error) {
    console.error("VERIFY QR AND PLACE ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify QR payment",
    });
  }
};

/* STEP 3b - VERIFY QR PAID + APPLY TO AN EXISTING ORDER'S DUE (mirrors verifyRazorpayDuePayment) */
export const verifyDueQrPayment = async (req, res) => {
  try {
    const { qrCodeId, orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qrCode = await razorpayInstance.qrCode.fetch(qrCodeId);
    const paid =
      qrCode.status === "closed" &&
      qrCode.close_reason === "paid" &&
      qrCode.payments_amount_received >= qrCode.payment_amount;

    if (!paid) {
      return res.status(400).json({
        success: false,
        message: "This QR code has not been paid yet",
      });
    }

    const amountPaid = qrCode.payments_amount_received / 100;

    const payments = await razorpayInstance.qrCode.fetchAllPayments(qrCodeId);
    const razorpayPaymentId = payments.items?.[0]?.id ?? null;

    await Payment.create({
      orderId: order.orderId,
      amount: amountPaid,
      mode: "QR",
      razorpayOrderId: qrCodeId,
      razorpayPaymentId,
      status: "SUCCESS",
    });

    order.paidAmount += amountPaid;
    order.dueAmount = Math.max(0, order.dueAmount - amountPaid);
    if (order.paymentMode !== "QR") {
      order.paymentMode =
        order.paymentMode === "CASH" ? "MIXED" : order.paymentMode;
    }
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment received",
      order,
    });
  } catch (error) {
    console.error("VERIFY DUE QR PAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify QR payment",
    });
  }
};
