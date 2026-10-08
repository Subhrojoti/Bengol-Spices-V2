import crypto from "crypto";
import Counter from "../models/Counter.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Employee from "../models/Employee.js";
import Admin from "../models/Admin.js";
import Order from "../models/Order.js";
import Store from "../models/store.js";
import Product from "../models/Product.js";
import Invoice from "../models/Invoice.js";
import { createInvoiceFromOrder } from "../services/invoice.service.js";
import { createShiprocketOrder } from "../services/shiprocket.service.js";
import Payment from "../models/Payment.js";
import { createNotification } from "../services/notification.service.js";
import { razorpayInstance } from "../config/razorpay.js";
import Agent from "../models/Agent.js";
import { updateTargetProgress } from "../services/target.service.js";
import { TIER_FIELDS, getLocationOverrides } from "../utils/pricing.js";
import { quantityWithUnit } from "../utils/uom.js";
import { publish } from "../services/liveEvents.js";
import mongoose from "mongoose";
import GatewayPayment from "../models/GatewayPayment.js";
import {
  applyDuePayment,
  beginGatewayPayment,
  markGatewayPayment,
  paymentsNeedingAttention,
  refundGatewayPayment,
  respondToClaimedGatewayPayment,
  settleFailedGatewayPayment,
} from "../services/payment.service.js";

/* =============================
   HELPER: Resolve tiered price based on store type
   Returns the correct price for a product given the store's category.
   Falls back to item.unitPrice if no tiered price is set (backward safe).
   ============================= */
const resolvePrice = (productDoc, storeType, fallbackUnitPrice, override) => {
  if (!productDoc) return fallbackUnitPrice;

  const field = TIER_FIELDS[storeType];

  // A price the admin set for this territory wins over everything
  const locationPrice = override?.[field];
  if (typeof locationPrice === "number" && locationPrice > 0) {
    return locationPrice;
  }

  const tieredPrice = productDoc[field];

  // ✅ Only use tiered price if it's set and valid (> 0)
  if (tieredPrice !== null && tieredPrice !== undefined && tieredPrice > 0) {
    return tieredPrice;
  }

  /* 🔒 FIX: without a tiered price, the agent's own unitPrice was charged
     as sent, so a hand-made request could sell at any price at all. It is
     accepted now only when it matches one of the product's catalogue
     prices (what the apps show); anything else is replaced by the
     catalogue price. */
  const catalogue = [productDoc.discountPrice, productDoc.price].filter(
    (p) => typeof p === "number" && p > 0,
  );

  if (!catalogue.length) return fallbackUnitPrice;

  const sent = Number(fallbackUnitPrice);
  const matches = catalogue.some((p) => Math.abs(p - sent) < 0.005);

  return matches ? sent : catalogue[0];
};

const roundRupees = (value) => Math.round(Number(value) * 100) / 100;

/* Razorpay's own record of a payment — the amount actually charged, never
   the amount the app reports. Returns null unless it belongs to the given
   Razorpay order and the money was taken. */
const fetchVerifiedRazorpayPayment = async (paymentId, razorpayOrderId) => {
  const payment = await razorpayInstance.payments.fetch(paymentId);

  if (
    !payment ||
    payment.order_id !== razorpayOrderId ||
    !["captured", "authorized"].includes(payment.status)
  ) {
    return null;
  }

  return payment;
};

// Signature check that takes the same time whether or not it matches
const signatureMatches = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (typeof signature !== "string") return false;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
};

/* =============================
   HELPER: STOCK RESERVATION

   🔥 FIX: nothing in the codebase ever changed Product.stock. Placing an
   order left it untouched, so the number shown in the catalog was whatever
   was typed at product creation and never moved again. Agents could order
   far more than existed, and "out of stock" never happened.

   The decrement is a conditional atomic update rather than read-then-save:
   `stock: { $gte: quantity }` means two orders landing at the same moment
   cannot both pass the check and oversell the last unit. A null result means
   there was not enough left.
   ============================= */
export const releaseStock = async (lines) => {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.productId },
      { $inc: { stock: line.quantity } },
    );
  }
};

/**
 * Takes stock for every line, or takes none at all.
 * @returns {{ok: true, taken: Array}|{ok: false, message: string}}
 */
export const reserveStock = async (lines) => {
  const taken = [];

  for (const line of lines) {
    const updated = await Product.findOneAndUpdate(
      { _id: line.productId, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
      { new: true },
    );

    if (!updated) {
      // Put back whatever this order already took, so a partial failure
      // never leaves stock quietly missing.
      await releaseStock(taken);

      const product = await Product.findById(line.productId).select(
        "name stock uom",
      );

      return {
        ok: false,
        message: product
          ? `Not enough stock for ${product.name}. Asked for ${line.quantity}, only ${quantityWithUnit(product.stock, product.uom)} left.`
          : "A product in this order is no longer available",
      };
    }

    taken.push(line);
  }

  return { ok: true, taken };
};

// PLACE ORDER (AGENT)
export const placeOrder = async (req, res) => {
  /* Tracked outside the try so the catch can hand stock back if anything
     fails after it was taken — otherwise a crash between the reservation
     and a saved order would quietly lose inventory. */
  let reservedLines = [];

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

    /* 🔒 A payment made online is only ever recorded by the two pay-first
       flows (verifyPaymentAndPlaceOrder and verifyQrAndPlaceOrder), after
       Razorpay itself has confirmed the money. They mark the request before
       handing it to this function.

       This route can also be called directly, and it used to take
       paymentMode and the Razorpay reference on trust. A hand-made request
       saying "ONLINE" with any made-up payment id placed an order recorded
       as paid through the gateway: money the company never received, and
       which the agent was never asked to hand over as cash. Called
       directly, an order can only be paid in cash, which is all the web
       panel and the agent app have ever sent here. */
    if (
      req.gatewayPaymentVerified !== true &&
      (paymentMode !== "CASH" ||
        razorpay_order_id ||
        razorpay_payment_id ||
        razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Online and QR payments are confirmed on the payment screen. Pay from there, or choose Cash.",
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

    // Location prices the admin set for this agent's territory, if any
    const locationPrices = await getLocationOverrides(
      agentId,
      store.address?.state,
    );

    /* =============================
       PRODUCT VALIDATION & AMOUNT
       ============================= */

    let totalAmount = 0;

    /* Every line that maps to a real product, so stock can be taken for it
       once the whole order has passed validation. */
    const stockLines = [];

    for (const item of products) {
      // BASIC VALIDATION
      if (
        !item.name ||
        !item.uom ||
        !item.quantity ||
        !item.unitPrice ||
        !Number.isFinite(Number(item.quantity)) ||
        !Number.isFinite(Number(item.unitPrice)) ||
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
        // A malformed id used to reach the database and answer 500
        productDoc = mongoose.isValidObjectId(item.productId)
          ? await Product.findById(item.productId)
          : null;
      } else {
        productDoc = await Product.findOne({
          name: item.name,
          status: "ACTIVE",
        });
      }

      /* 🔒 FIX: a line that matched no product used to be accepted anyway,
         with whatever name and price the request carried and no stock
         taken. Every line must now be a real, active catalogue product. */
      if (!productDoc || productDoc.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          message: `${item.name} is no longer available. Please remove it from the cart.`,
        });
      }

      /* =============================
         ENRICH DATA + RESOLVE TIERED PRICE
         ============================= */

      if (productDoc) {
        item.productId = productDoc._id;
        item.name = productDoc.name;
        /* The unit the product is sold by now, not whatever the app had
           when it last loaded the catalogue: a product the office has just
           changed from "gm" to "packet" is recorded as packets straight
           away, and a request made by hand cannot label the line anything
           it likes. */
        item.uom = productDoc.uom || item.uom;
        item.image = productDoc.images?.front?.url;
        item.gstPercentage = productDoc.gstPercentage || 0;

        // ✅ NEW: Auto-resolve correct price based on store type
        // If tiered price exists for this storeType → use it
        // If not → keep item.unitPrice as sent by agent (backward safe)
        item.unitPrice = resolvePrice(
          productDoc,
          storeType,
          item.unitPrice,
          locationPrices.get(String(productDoc._id)),
        );

        stockLines.push({
          productId: productDoc._id,
          quantity: Number(item.quantity),
        });
      }

      /* =============================
         CALCULATE TOTAL
         ============================= */

      /* Rounded to paise. Plain float sums (12.1 × 3 = 36.300000000000004)
         left an order paid in full owing a fraction of a paisa, so it stayed
         PENDING and listed as due for good. */
      item.totalPrice = roundRupees(Number(item.quantity) * item.unitPrice);
      totalAmount = roundRupees(totalAmount + item.totalPrice);
    }

    // The apps add up the cart with the same float error, so what they send
    // as "paid in full" is rounded the same way before it is compared.
    const paid = roundRupees(paidAmount);

    if (!Number.isFinite(paid) || paid < 0 || paid > totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Invalid paid amount",
      });
    }

    /* The Order model requires at least ₹1 paid. Anything less used to pass
       here and then fail validation after stock had been reserved. */
    if (paid < 1) {
      return res.status(400).json({
        success: false,
        message: "Paid amount must be at least ₹1",
      });
    }

    const dueAmount = roundRupees(totalAmount - paid);

    /* 🔥 FIX: verifyPaymentAndPlaceOrder labels an order ONLINE only when the
       amount paid equals orderPayload.totalAmount — a field the app never
       sends (the total is worked out here). Every order paid online arrived
       as MIXED, even one paid in full. Now that the total is known, a
       verified Razorpay payment covering all of it is ONLINE. */
    const finalPaymentMode =
      paymentMode === "MIXED" && razorpay_payment_id && dueAmount < 0.005
        ? "ONLINE"
        : paymentMode;

    /* =============================
       TAKE STOCK

       Done after every other check has passed, so a rejection for some
       unrelated reason never leaves stock held against an order that was
       not created.
       ============================= */

    const reservation = await reserveStock(stockLines);

    if (!reservation.ok) {
      return res.status(400).json({
        success: false,
        message: reservation.message,
      });
    }

    reservedLines = reservation.taken;

    /* =============================
       SAFE ORDER ID GENERATION
       ============================= */

    const currentYear = new Date().getFullYear();
    const orderCounter = `order_${currentYear}`;

    const nextOrderId = async () => {
      const counter = await Counter.findByIdAndUpdate(
        orderCounter,
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      return `ORD${currentYear}-${String(counter.seq).padStart(4, "0")}`;
    };

    /* The counter can fall behind the orders that exist (orders brought in
       from a backup or by hand without their counter). Every number it then
       hands out is already taken. Moved up to the newest order's number, so
       the next one is free. */
    const catchUpOrderCounter = async () => {
      const newest = await Order.findOne({
        orderId: { $regex: `^ORD${currentYear}-\\d+$` },
      })
        .sort({ createdAt: -1 })
        .select("orderId")
        .lean();

      const serial = Number(newest?.orderId?.split("-")[1]);

      if (Number.isFinite(serial)) {
        await Counter.updateOne(
          { _id: orderCounter },
          { $max: { seq: serial } },
          { upsert: true },
        );
      }
    };

    const orderId = await nextOrderId();

    /* =============================
       DUE DATE (7 DAYS)
       ============================= */

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    /* =============================
       CREATE ORDER
       ============================= */

    const orderFields = {
      orderId,
      consumerId,
      store: store._id,
      agentId,
      products,
      totalAmount,
      paidAmount: paid,
      dueAmount,
      paymentMode: finalPaymentMode,
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
    };

    /* A number that turns out to be taken is not a reason to refuse the
       order. It used to be: the agent was shown the database's own
       "E11000 duplicate key" error, and so was everyone after them until
       the counter had crept past the numbers in use. The counter is caught
       up and the order saved under the next free number instead. */
    let order = null;

    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      try {
        order = await Order.create(orderFields);
      } catch (createError) {
        if (createError.code !== 11000 || !createError.keyPattern?.orderId) {
          throw createError;
        }

        await catchUpOrderCounter();
        orderFields.orderId = await nextOrderId();
      }
    }

    if (!order) {
      throw new Error("Could not give this order a number. Please try again.");
    }

    /* The order now owns the stock it reserved. Releasing it on a later
       failure put stock back for goods that were still going out, and the
       500 invited the agent to place the same order again. */
    reservedLines = [];

    // ✅ Create payment entry for CASH / initial payment
    try {
      await Payment.create({
        orderId: order.orderId,
        consumerId: order.consumerId,
        agentId: order.agentId,
        amount: paid,
        // 🔥 FIX: a partly-online ("MIXED") or QR payment carries a verified
        // Razorpay reference but was being recorded as CASH, so cash
        // reconciliation expected money the agent never held.
        method:
          paymentMode === "ONLINE" || razorpay_payment_id || razorpay_order_id
            ? "RAZORPAY"
            : "CASH",
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
    } catch (paymentError) {
      // The order already records the amount paid; only the payment log
      // entry is missing, and it needs adding by hand.
      console.error(
        `PAYMENT RECORD FAILED for placed order ${order.orderId} (₹${paid}):`,
        paymentError,
      );
    }

    /* Tell every open admin/employee panel now, before the invoice PDF is
       built and uploaded, which can take a few seconds */
    publish(
      "ORDER_PLACED",
      {
        order: {
          orderId: order.orderId,
          storeName: order.deliveryAddress.storeName,
          city: order.deliveryAddress.city,
          agentId: order.agentId,
          totalAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          dueAmount: order.dueAmount,
          paymentMode: order.paymentMode,
          itemCount: order.products.length,
          createdAt: order.createdAt,
        },
      },
      "canGetAllOrders",
    );

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

    /* The payment taken with the order counts toward PAYMENT targets however
       it was collected. Only the online (Razorpay) flow used to count it, so
       cash and QR collected at order time were never credited. Every place
       that places an order comes through here, so it is counted once. */
    if (paid > 0) {
      await updateTargetProgress({
        agentId,
        type: "PAYMENT",
        value: 1,
        amount: paid,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: order.orderId,
    });
  } catch (error) {
    console.error("PLACE ORDER ERROR:", error);

    // The order was never saved, so the stock it held must go back.
    if (reservedLines.length) {
      await releaseStock(reservedLines).catch((releaseError) =>
        console.error("STOCK ROLLBACK FAILED:", releaseError),
      );
    }

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

    // Only the two fields used below; each invoice also carries every line
    // item and payment, which this list never shows
    const invoices = await Invoice.find({
      orderId: { $in: orderIds },
    })
      .select("orderId invoiceNumber")
      .lean();

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

    /* One conditional update, not read → change → save. The save wrote
       "CONFIRMED" over whatever the order had become in the meantime: an
       order cancelled a moment earlier (its stock already handed back) came
       back to life as confirmed, and two people confirming together both
       succeeded and logged it twice. The filter only matches an order that
       is still PLACED. */
    const confirmed = await Order.findOneAndUpdate(
      { _id: order._id, status: "PLACED" },
      {
        $set: { status: "CONFIRMED" },
        $push: {
          statusHistory: {
            status: "CONFIRMED",
            changedAt: new Date(),
            changedBy: {
              id: req.user.employeeId || req.user.id,
              role: req.user.role, // VERY IMPORTANT
            },
          },
        },
      },
      { new: true },
    );

    if (!confirmed) {
      return res.status(409).json({
        success: false,
        message:
          "This order was changed a moment ago. Refresh to see where it stands.",
      });
    }

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

    // Text only: anything else used to throw on .trim() and answer 500
    if (typeof reason !== "string" || reason.trim() === "") {
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

    /* The status checks above read the order, and this writes it back. Two
       cancels arriving together - a double click, or a retried request -
       both read a status that was not yet CANCELLED, both passed, and both
       handed the same stock back, inventing inventory that does not exist.

       The transition is now one atomic conditional update: the filter only
       matches an order that is not already cancelled or delivered, so the
       second request changes nothing and gets null back. Stock is released
       only by the request that actually performed the transition. */
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: { $nin: ["CANCELLED", "DELIVERED"] } },
      {
        $set: {
          status: "CANCELLED",
          cancellation: {
            reason: reason.trim(),
            cancelledAt: new Date(),
            cancelledBy: {
              id: cancelledById,
              name: cancelledByName,
              role: cancelledByRole,
            },
          },
        },
        $push: {
          statusHistory: {
            status: "CANCELLED",
            // Set here rather than leaning on the schema default, so the
            // entry carries a time whatever the driver does with defaults
            // on a $push.
            changedAt: new Date(),
            changedBy: {
              id: cancelledById,
              role: cancelledByRole,
            },
          },
        },
      },
      { new: true },
    );

    // Another request cancelled it (or it was delivered) in between
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    /* Goods never left, so the stock this order was holding goes back.
       Released only after the cancellation is recorded: an order that failed
       to save must not hand stock back, or it would be sold twice. */
    const linesToReturn = (cancelled.products || [])
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }));

    if (linesToReturn.length) {
      await releaseStock(linesToReturn).catch((restoreError) =>
        console.error("STOCK RESTORE ON CANCEL FAILED:", restoreError),
      );
    }

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

    // A malformed id used to reach the database and answer 500
    const partner = mongoose.isValidObjectId(partnerId)
      ? await DeliveryPartner.findById(partnerId)
      : null;

    if (!partner || partner.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found or inactive",
      });
    }
    // Check if already assigned to this partner
    if (order.delivery?.partnerId?.toString() === String(partner._id)) {
      return res.status(400).json({
        success: false,
        message: "This partner is already assigned",
      });
    }

    /* ✅ Assign delivery, as one conditional update rather than read →
       change → save. The save wrote "ASSIGNED" over whatever the order had
       become since it was read, so an order cancelled in that moment (its
       stock already handed back) went out for delivery anyway. The filter
       only matches an order that can still be assigned. */
    const assigned = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["CONFIRMED", "ASSIGNED"] } },
      {
        $set: {
          status: "ASSIGNED",
          // The whole block, as before: a new partner starts with a clean
          // delivery-code attempt count
          delivery: {
            partnerId: partner._id,
            assignedBy: req.user._id || req.user.id, // 🔥 FIXED (generic)
            assignedAt: new Date(),
            codeAttempts: 0,
          },
        },
        $push: {
          statusHistory: {
            status: "ASSIGNED",
            changedAt: new Date(),
            changedBy: {
              id: req.user._id || req.user.id,
              role: req.user.role,
            },
          },
        },
      },
      { new: true },
    );

    if (!assigned) {
      return res.status(409).json({
        success: false,
        message:
          "This order was changed a moment ago. Refresh to see where it stands.",
      });
    }

    /* Told only once the assignment is saved (it used to go out first, so a
       failed save still told the partner about an order that was not
       theirs). A notification that cannot be written must not undo or fail
       the assignment: the order is already in the partner's list. */
    await createNotification({
      title: "New Order Assigned",
      message: `You have a new order (${order.orderId}) assigned`,
      recipientId: partner._id, // 🔥 FIXED
      recipientModel: "DeliveryPartner",
      meta: {
        orderId: order.orderId,
      },
    }).catch((notifyError) =>
      console.error("ASSIGNMENT NOTIFICATION FAILED:", notifyError),
    );

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
const MAX_CODE_ATTEMPTS = 5;
const CODE_LOCK_MS = 15 * 60 * 1000;

const codesMatch = (entered, expected) =>
  entered.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(entered), Buffer.from(expected));

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

    // Must be assigned to this delivery partner (an unassigned order has no
    // delivery block at all, which used to throw here)
    if (
      !order.delivery?.partnerId ||
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

    /* 🔒 FIX: every store gets a delivery code when it is registered, and
       its agent gives that code to the store owner, but nothing ever asked
       for it: a partner could mark any assigned order delivered without
       going to the store. The partner app even displayed the code. The
       store owner now reads it out at handover, and it is checked here. */
    if (status === "DELIVERED") {
      const lockedUntil = order.delivery.codeLockedUntil;

      if (lockedUntil && lockedUntil > new Date()) {
        const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Too many wrong delivery codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or contact the office.`,
        });
      }

      const deliveryCode =
        typeof req.body.deliveryCode === "string"
          ? req.body.deliveryCode.trim()
          : "";

      if (!/^\d{6}$/.test(deliveryCode)) {
        return res.status(400).json({
          success: false,
          message: "Enter the store's 6-digit delivery code",
        });
      }

      const store =
        (order.store &&
          (await Store.findById(order.store).select("deliveryCode").lean())) ||
        (await Store.findOne({ consumerId: order.consumerId })
          .select("deliveryCode")
          .lean());

      if (!store?.deliveryCode) {
        return res.status(409).json({
          success: false,
          message:
            "This store has no delivery code on file. Contact the office to confirm this delivery.",
        });
      }

      /* 🔒 Every try is taken BEFORE the code is compared, in one
         conditional update that only succeeds while fewer than five tries
         are on record and no lock is running.

         The count used to be added after a wrong guess. Many guesses sent
         at the same instant all read "not locked yet", were all compared,
         and only then counted, so a script could try hundreds of codes in
         every 15-minute window instead of five. Now the sixth request in a
         burst finds the five tries already taken and is turned away without
         its code ever being looked at. */
      const lockMinutes = Math.round(CODE_LOCK_MS / 60000);
      const lockNow = () =>
        Order.updateOne(
          { _id: order._id },
          {
            $set: {
              "delivery.codeAttempts": 0,
              "delivery.codeLockedUntil": new Date(Date.now() + CODE_LOCK_MS),
            },
          },
        );

      const attempt = await Order.findOneAndUpdate(
        {
          _id: order._id,
          $and: [
            {
              $or: [
                { "delivery.codeLockedUntil": { $exists: false } },
                { "delivery.codeLockedUntil": null },
                { "delivery.codeLockedUntil": { $lte: new Date() } },
              ],
            },
            {
              $or: [
                { "delivery.codeAttempts": { $exists: false } },
                { "delivery.codeAttempts": null },
                { "delivery.codeAttempts": { $lt: MAX_CODE_ATTEMPTS } },
              ],
            },
          ],
        },
        { $inc: { "delivery.codeAttempts": 1 } },
        { new: true },
      );

      if (!attempt) {
        /* Five tries are on record with no lock running: the request that
           took the fifth never got to start the lock (it was cut off).
           Started here, so the count cannot stay stuck at five for good. */
        const current = await Order.findById(order._id)
          .select("delivery.codeLockedUntil")
          .lean();
        const running =
          current?.delivery?.codeLockedUntil &&
          new Date(current.delivery.codeLockedUntil) > new Date();

        if (!running) await lockNow();

        return res.status(429).json({
          success: false,
          message: `Too many wrong delivery codes. Confirming this delivery is locked for up to ${lockMinutes} minutes. Try again later, or contact the office.`,
        });
      }

      if (!codesMatch(deliveryCode, store.deliveryCode)) {
        const attempts = attempt.delivery?.codeAttempts || 0;

        if (attempts >= MAX_CODE_ATTEMPTS) {
          await lockNow();

          return res.status(429).json({
            success: false,
            message:
              "Wrong delivery code entered 5 times. Confirming this delivery is locked for 15 minutes.",
          });
        }

        const left = MAX_CODE_ATTEMPTS - attempts;
        return res.status(400).json({
          success: false,
          message: `That delivery code does not match. ${left} attempt${left === 1 ? "" : "s"} left.`,
        });
      }

    }

    /* One conditional update, not read → change → save. The save wrote the
       new status over whatever the order had become since it was read: an
       order the office cancelled in that moment (its stock already handed
       back) was marked shipped or delivered anyway, and a double tap logged
       the same step twice. The filter only matches an order that is still
       at the step this request started from, with this partner. */
    const now = new Date();
    const update = {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          changedAt: now,
          changedBy: {
            id: req.user.id,
            role: req.user.role,
          },
        },
      },
    };

    if (status === "DELIVERED") {
      update.$set["delivery.codeAttempts"] = 0;
      update.$set["delivery.deliveredAt"] = now;
      update.$unset = { "delivery.codeLockedUntil": "" };
    }

    const moved = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        "delivery.partnerId": order.delivery.partnerId,
      },
      update,
      { new: true },
    );

    if (!moved) {
      return res.status(409).json({
        success: false,
        message:
          "This order was changed a moment ago. Refresh to see where it stands.",
      });
    }

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

// Collect Payment (Agent) — cash or another offline method, against a due
const OFFLINE_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];

export const collectPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note } = req.body;
    const method = req.body.method || "CASH";

    /* 🔥 FIX: amount was used as sent. A negative amount passed every check
       below and was recorded — lowering the order's paid total and raising
       its due. A numeric string was concatenated rather than added. */
    const amount = Math.round(Number(req.body.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid amount of at least ₹1",
      });
    }

    // A Razorpay payment is recorded only once Razorpay itself confirms it
    if (!OFFLINE_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    /* Checked and recorded under the order's payment lock (see
       applyDuePayment): two identical requests arriving together used to
       both pass the due check and both be recorded. */
    const result = await applyDuePayment({
      orderId,
      agentId: req.user.agentId,
      amount,
      method,
      note,
    });

    if (!result.ok) {
      return res.status(result.code).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      message: "Payment recorded successfully",
      paidAmount: result.order.paidAmount,
      dueAmount: result.order.dueAmount,
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
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      // Text that is not a date reached the database and answered 500
      if (
        (from && Number.isNaN(from.getTime())) ||
        (to && Number.isNaN(to.getTime()))
      ) {
        return res.status(400).json({
          success: false,
          message: "fromDate and toDate must be valid dates",
        });
      }

      orderFilter.createdAt = {};
      if (from) orderFilter.createdAt.$gte = from;
      if (to) orderFilter.createdAt.$lte = to;
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

    if (order.agentId !== req.user.agentId) {
      return res.status(403).json({
        message: "You are not allowed to collect payment for this order",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ message: "This order was cancelled" });
    }

    if (order.dueAmount <= 0) {
      return res.status(400).json({ message: "No due amount left" });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      // Razorpay needs whole paise: 14.29 * 100 is 1428.9999…, which it refuses
      amount: Math.round(order.dueAmount * 100),
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

/* Shared ending for a gateway payment that threw part-way: never leave it
   PROCESSING with no answer. */
const failClaimedPayment = async (res, claim, error, fallbackMessage) => {
  if (claim) {
    try {
      return await settleFailedGatewayPayment(res, claim, {
        code: 500,
        message: error?.message,
      });
    } catch (settleError) {
      console.error("COULD NOT RECORD PAYMENT FAILURE:", settleError);
    }
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
};

// Verify Razorpay Payment (a due, paid online)
export const verifyRazorpayPayment = async (req, res) => {
  let claim = null;

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    // 🔐 Verify Signature
    if (
      !signatureMatches(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    /* 🔒 FIX: the amount recorded used to be the "amount" field the app sent.
       The signature only proves the payment is real, not how much it was
       for, so paying ₹1 and reporting the full due marked the order paid.
       The web app also reported the figure typed into the form while
       Razorpay charged the full due. The amount now comes from Razorpay. */
    const razorpayPayment = await fetchVerifiedRazorpayPayment(
      razorpay_payment_id,
      razorpay_order_id,
    );

    if (!razorpayPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment could not be confirmed with Razorpay",
      });
    }

    const amount = Number(razorpayPayment.amount) / 100; // paise → rupees

    /* 🔍 Idempotency. Claimed before anything is recorded, so the same
       payment sent twice at once is applied once; the old "already
       processed?" lookup let two simultaneous requests both through. */
    const began = await beginGatewayPayment(`payment:${razorpay_payment_id}`, {
      purpose: "ORDER_DUE",
      agentId: req.user.agentId,
      orderId,
      amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentIds: [razorpay_payment_id],
    });

    if (!began.ok) return respondToClaimedGatewayPayment(res, began.record);
    claim = began.record;

    // Recorded before payments were claimed like this
    const existing = await Payment.findOne({
      razorpayPaymentId: String(razorpay_payment_id),
    });

    if (existing) {
      await markGatewayPayment(claim, {
        status: "APPLIED",
        orderId: existing.orderId,
      });
      return respondToClaimedGatewayPayment(res, {
        status: "APPLIED",
        orderId: existing.orderId,
      });
    }

    const result = await applyDuePayment({
      orderId,
      agentId: req.user.agentId,
      amount,
      method: "RAZORPAY",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    // Refused (cancelled order, due already paid…): refunded, not just logged
    if (!result.ok) return settleFailedGatewayPayment(res, claim, result);

    await markGatewayPayment(claim, { status: "APPLIED" });

    res.json({
      success: true,
      message: "Payment successful",
    });
  } catch (error) {
    console.error("RAZORPAY VERIFY ERROR:", error);
    return failClaimedPayment(res, claim, error, "Payment verification failed");
  }
};


// Initial Payment Razorpayment during placing order
export const createOrderPayment = async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum amount should be ₹1",
      });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      // Whole paise only — see createRazorpayOrder
      amount: Math.round(amount * 100),
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

// Runs placeOrder for a pay-first flow and hands back what it answered
const placeOrderFor = (req) =>
  new Promise((resolve, reject) => {
    placeOrder(req, {
      status: (code) => ({
        json: (data) => resolve({ code, data }),
      }),
    }).catch(reject);
  });

// Verify initial payment for order placement
export const verifyPaymentAndPlaceOrder = async (req, res) => {
  let claim = null;

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderPayload, // 👈 full order body (same as placeOrder)
    } = req.body;

    if (!orderPayload || typeof orderPayload !== "object") {
      return res.status(400).json({
        success: false,
        message: "Order details are missing",
      });
    }

    /* =============================
       🔐 VERIFY SIGNATURE
       ============================= */

    if (
      !signatureMatches(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    /* 🔒 FIX: the paid amount was the "amount" the app sent, so a ₹1 payment
       reported as the full total placed a fully-paid order. It now comes
       from Razorpay's record of the payment. */
    const razorpayPayment = await fetchVerifiedRazorpayPayment(
      razorpay_payment_id,
      razorpay_order_id,
    );

    if (!razorpayPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment could not be confirmed with Razorpay",
      });
    }

    const amount = Number(razorpayPayment.amount) / 100; // paise → rupees

    /* =============================
       🔁 DUPLICATE CHECK — claimed before the order is placed, so the same
       payment submitted twice at once places one order, not two
       ============================= */

    const began = await beginGatewayPayment(`payment:${razorpay_payment_id}`, {
      purpose: "ORDER_INITIAL",
      agentId: req.user.agentId,
      amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentIds: [razorpay_payment_id],
    });

    if (!began.ok) return respondToClaimedGatewayPayment(res, began.record);
    claim = began.record;

    // Recorded before payments were claimed like this, or by an attempt
    // that crashed after placing the order
    const existing = await Payment.findOne({
      razorpayPaymentId: String(razorpay_payment_id),
    });

    if (existing) {
      await markGatewayPayment(claim, {
        status: "APPLIED",
        orderId: existing.orderId,
      });
      return respondToClaimedGatewayPayment(res, {
        status: "APPLIED",
        orderId: existing.orderId,
      });
    }

    /* =============================
       🧠 USE YOUR EXISTING LOGIC
       ============================= */

    req.body = {
      ...orderPayload,
      paidAmount: amount, // ✅ override safely
      paymentMode: amount === orderPayload.totalAmount ? "ONLINE" : "MIXED",
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

    // Razorpay has confirmed this payment above; see the check in placeOrder
    req.gatewayPaymentVerified = true;

    const response = await placeOrderFor(req);

    /* The money has been taken but no order exists. Used to be a log line
       only: a refused order (out of stock, bad cart) is now refunded, and an
       unexpected failure is kept for a retry and listed for the office. */
    if (!response.data.success) {
      console.error("ONLINE PAYMENT TAKEN BUT ORDER NOT PLACED:", {
        razorpay_payment_id,
        agentId: req.user?.agentId,
        amount,
        reason: response.data.message,
      });
      return settleFailedGatewayPayment(res, claim, {
        code: response.code,
        message: response.data.message,
      });
    }

    // The PAYMENT target is credited inside placeOrder, as it is for cash
    // and QR, so it is not added again here.
    await markGatewayPayment(claim, {
      status: "APPLIED",
      orderId: response.data.orderId,
    });

    return res.json({
      success: true,
      message: "Order placed with payment",
      orderId: response.data.orderId,
    });
  } catch (error) {
    console.error("VERIFY + PLACE ORDER ERROR:", error);
    return failClaimedPayment(res, claim, error, "Order placement failed");
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
    // A text or sub-rupee amount went straight to Razorpay, which refused it
    // and the agent only saw "Failed to generate QR code"
    const amount = roundRupees(req.body.amount);

    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum amount should be ₹1",
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
    if (order.agentId !== req.user.agentId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to collect payment for this order",
      });
    }
    // Refused before a QR is shown, as the online checkout already is. The
    // customer used to pay first and be refunded afterwards.
    if (order.status === "CANCELLED") {
      return res
        .status(400)
        .json({ success: false, message: "This order was cancelled" });
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
  let claim = null;

  try {
    const { qrCodeId, orderPayload } = req.body;

    if (typeof qrCodeId !== "string" || !qrCodeId) {
      return res.status(400).json({
        success: false,
        message: "QR code reference is missing",
      });
    }

    if (!orderPayload || typeof orderPayload !== "object") {
      return res.status(400).json({
        success: false,
        message: "Order details are missing",
      });
    }

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

    // A QR generated by a different agent, or for a due payment, is not this order's
    if (
      qrCode.notes?.agentId !== req.user.agentId ||
      qrCode.notes?.purpose !== "order_initial_payment"
    ) {
      return res.status(403).json({
        success: false,
        message: "This QR code does not belong to this order",
      });
    }

    const payments = await razorpayInstance.qrCode.fetchAllPayments(qrCodeId);
    const paymentIds = (payments.items || [])
      .map((item) => item.id)
      .filter(Boolean);

    // 🔒 FIX: was the "amount" the app sent; now what the QR actually received
    const amount = qrCode.payments_amount_received / 100;

    /* 🔒 FIX: one paid QR could be submitted again and again, placing a new
       "paid" order each time. It is claimed before the order is placed, so
       two submissions arriving together cannot both get through either. */
    const began = await beginGatewayPayment(`qr:${qrCodeId}`, {
      purpose: "ORDER_INITIAL",
      agentId: req.user.agentId,
      amount,
      qrCodeId,
      razorpayPaymentIds: paymentIds,
    });

    if (!began.ok) return respondToClaimedGatewayPayment(res, began.record);
    claim = began.record;

    // Used before QR codes were claimed like this
    const alreadyUsed = await Payment.findOne({ razorpayOrderId: qrCodeId });
    if (alreadyUsed) {
      await markGatewayPayment(claim, {
        status: "APPLIED",
        orderId: alreadyUsed.orderId,
      });
      return respondToClaimedGatewayPayment(res, {
        status: "APPLIED",
        orderId: alreadyUsed.orderId,
      });
    }

    req.body = {
      ...orderPayload,
      paymentMode: "QR",
      paidAmount: amount,
      // placeOrder reads these snake_case names; the camelCase ones it was
      // given were silently ignored, so the QR was never linked to the payment
      razorpay_order_id: qrCodeId,
      razorpay_payment_id: paymentIds[0] ?? null,
    };

    // Razorpay has confirmed this QR was paid above; see the check in placeOrder
    req.gatewayPaymentVerified = true;

    const response = await placeOrderFor(req);

    if (!response.data.success) {
      console.error("QR PAYMENT TAKEN BUT ORDER NOT PLACED:", {
        qrCodeId,
        agentId: req.user?.agentId,
        amount,
        reason: response.data.message,
      });
      return settleFailedGatewayPayment(res, claim, {
        code: response.code,
        message: response.data.message,
      });
    }

    await markGatewayPayment(claim, {
      status: "APPLIED",
      orderId: response.data.orderId,
    });

    return res.status(response.code).json(response.data);
  } catch (error) {
    console.error("VERIFY QR AND PLACE ORDER ERROR:", error);
    return failClaimedPayment(res, claim, error, "Failed to verify QR payment");
  }
};

/* STEP 3b - VERIFY QR PAID + APPLY TO AN EXISTING ORDER'S DUE (mirrors verifyRazorpayDuePayment) */
export const verifyDueQrPayment = async (req, res) => {
  let claim = null;

  try {
    const { qrCodeId, orderId } = req.body;

    if (typeof qrCodeId !== "string" || !qrCodeId) {
      return res.status(400).json({
        success: false,
        message: "QR code reference is missing",
      });
    }

    const order = await Order.findOne({ orderId })
      .select("orderId agentId")
      .lean();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.agentId !== req.user.agentId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to collect payment for this order",
      });
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

    // A QR made for one order's due cannot settle another order
    if (
      qrCode.notes?.purpose !== "order_due_payment" ||
      qrCode.notes?.orderId !== order.orderId
    ) {
      return res.status(403).json({
        success: false,
        message: "This QR code does not belong to this order",
      });
    }

    const payments = await razorpayInstance.qrCode.fetchAllPayments(qrCodeId);
    const paymentIds = (payments.items || [])
      .map((item) => item.id)
      .filter(Boolean);

    const amount = qrCode.payments_amount_received / 100;

    /* 🔒 FIX: nothing stopped the same paid QR being applied repeatedly, and
       each time the order's paid amount grew again. It is now claimed first,
       which also stops two simultaneous submissions. */
    const began = await beginGatewayPayment(`qr:${qrCodeId}`, {
      purpose: "ORDER_DUE",
      agentId: req.user.agentId,
      orderId: order.orderId,
      amount,
      qrCodeId,
      razorpayPaymentIds: paymentIds,
    });

    if (!began.ok) return respondToClaimedGatewayPayment(res, began.record);
    claim = began.record;

    // Recorded before QR codes were claimed like this
    const alreadyUsed = await Payment.findOne({ razorpayOrderId: qrCodeId });
    if (alreadyUsed) {
      await markGatewayPayment(claim, {
        status: "APPLIED",
        orderId: alreadyUsed.orderId,
      });
      return respondToClaimedGatewayPayment(res, {
        status: "APPLIED",
        orderId: alreadyUsed.orderId,
      });
    }

    const result = await applyDuePayment({
      orderId: order.orderId,
      agentId: req.user.agentId,
      amount,
      method: "RAZORPAY",
      note: "QR payment",
      razorpayOrderId: qrCodeId,
      razorpayPaymentId: paymentIds[0],
      nextPaymentMode: (mode) => (mode === "CASH" ? "MIXED" : mode),
    });

    // Refused (cancelled order, due already paid…): refunded, not just logged
    if (!result.ok) return settleFailedGatewayPayment(res, claim, result);

    await markGatewayPayment(claim, { status: "APPLIED" });

    return res.status(200).json({
      success: true,
      message: "Payment received",
      order: result.order,
    });
  } catch (error) {
    console.error("VERIFY DUE QR PAYMENT ERROR:", error);
    return failClaimedPayment(res, claim, error, "Failed to verify QR payment");
  }
};

/* ============================================================
   PAYMENTS NEEDING ATTENTION

   A Razorpay or QR payment that was taken but could not be applied, and
   was not refunded automatically: an unexpected failure nobody retried, a
   refund Razorpay refused, or an attempt that crashed part-way.
   ============================================================ */

// The rule itself lives with the payment code, so the dashboard's count of
// these is always the same list
const needsAttentionFilter = paymentsNeedingAttention;

// List them (Admin / Employee with canSeePaymentInfo)
export const getPaymentIssues = async (req, res) => {
  try {
    const issues = await GatewayPayment.find(needsAttentionFilter())
      .sort({ createdAt: -1 })
      .lean();

    const agentIds = [
      ...new Set(issues.map((issue) => issue.agentId).filter(Boolean)),
    ];
    const agents = await Agent.find({ agentId: { $in: agentIds } })
      .select("agentId name phone")
      .lean();

    const agentMap = {};
    agents.forEach((agent) => {
      agentMap[agent.agentId] = agent;
    });

    return res.json({
      success: true,
      count: issues.length,
      data: issues.map((issue) => ({
        _id: issue._id,
        status: issue.status,
        purpose: issue.purpose,
        amount: issue.amount,
        agentId: issue.agentId,
        agentName: agentMap[issue.agentId]?.name || null,
        agentPhone: agentMap[issue.agentId]?.phone || null,
        orderId: issue.orderId || null,
        qrCodeId: issue.qrCodeId || null,
        razorpayPaymentIds: issue.razorpayPaymentIds || [],
        failureReason: issue.failureReason || null,
        refundError: issue.refundError || null,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      })),
    });
  } catch (error) {
    console.error("GET PAYMENT ISSUES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load payments needing attention",
    });
  }
};

// Takes one issue for an admin action, so a retry cannot run at the same time
const claimIssue = async (id) => {
  if (!mongoose.isValidObjectId(id)) return { code: 404 };

  const issue = await GatewayPayment.findOne({
    _id: id,
    ...needsAttentionFilter(),
  }).lean();

  if (!issue) return { code: 404 };

  // It may have gone through after all (a later retry, or a crash after the
  // order was saved); refunding it then would give the money back twice over
  const applied = await Payment.findOne(
    issue.qrCodeId
      ? { razorpayOrderId: issue.qrCodeId }
      : { razorpayPaymentId: { $in: issue.razorpayPaymentIds || [] } },
  ).lean();

  if (applied) {
    await markGatewayPayment(issue, {
      status: "APPLIED",
      orderId: applied.orderId,
    });
    return { code: 409, appliedTo: applied.orderId };
  }

  const claimed = await GatewayPayment.findOneAndUpdate(
    { _id: issue._id, status: issue.status, updatedAt: issue.updatedAt },
    { $set: { status: "PROCESSING" } },
    { new: true },
  );

  return claimed ? { issue: claimed } : { code: 409 };
};

const issueNotAvailable = (res, { code, appliedTo }) =>
  res.status(code).json({
    success: false,
    message: appliedTo
      ? `This payment was already recorded against order ${appliedTo}, so nothing was done.`
      : code === 404
        ? "This payment is not waiting for action"
        : "This payment is being handled right now. Refresh and check again.",
  });

// Refund it to the customer (Admin)
export const refundPaymentIssue = async (req, res) => {
  try {
    const claimed = await claimIssue(req.params.id);
    if (!claimed.issue) return issueNotAvailable(res, claimed);

    const { refunded, refundError } = await refundGatewayPayment(
      claimed.issue,
      claimed.issue.failureReason || "Refunded by the office",
    );

    if (!refunded) {
      return res.status(502).json({
        success: false,
        message: `Razorpay refused the refund: ${refundError}`,
      });
    }

    return res.json({
      success: true,
      message: "Payment refunded to the customer",
    });
  } catch (error) {
    console.error("REFUND PAYMENT ISSUE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refund the payment",
    });
  }
};

// Mark it settled by hand, e.g. the order was placed manually (Admin)
export const resolvePaymentIssue = async (req, res) => {
  try {
    const note =
      typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Add a note saying how this payment was settled",
      });
    }

    const claimed = await claimIssue(req.params.id);
    if (!claimed.issue) return issueNotAvailable(res, claimed);

    await markGatewayPayment(claimed.issue, {
      status: "RESOLVED",
      resolutionNote: note.slice(0, 500),
    });

    return res.json({
      success: true,
      message: "Marked as settled",
    });
  } catch (error) {
    console.error("RESOLVE PAYMENT ISSUE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update the payment",
    });
  }
};
