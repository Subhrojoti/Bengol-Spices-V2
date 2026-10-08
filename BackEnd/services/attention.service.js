/* =====================================================================
   WHAT IS WAITING ON THE OFFICE

   The dashboard reports how the business is doing. This answers the
   other question someone opening the panel has: "what do I need to deal
   with?" Each figure is something that stays stuck until a person acts:
   an order nobody has confirmed, a payment past its due date, an
   application nobody has looked at.

   Before this the only way to find them was to open every screen and
   read down every list.

   It only reads. Each section is worked out only for a caller allowed to
   open the screen where it is handled, so an employee is never shown a
   count (or an amount of money) from an area they have no access to.
   ===================================================================== */

import Order from "../models/Order.js";
import Return from "../models/Return.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Product from "../models/Product.js";
import GatewayPayment from "../models/GatewayPayment.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import { paymentsNeedingAttention } from "./payment.service.js";

// An order that has not moved for this long while out for delivery
const STALLED_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

// The same line the product list draws its "low stock" badge at
const LOW_STOCK = 10;

const roundRupees = (value) => Math.round(Number(value || 0) * 100) / 100;

const IN_TRANSIT = ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];

/* count + the oldest date, for records matching a filter */
const countAndOldest = async (Model, filter, dateField = "createdAt") => {
  const [row] = await Model.aggregate([
    { $match: filter },
    { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: `$${dateField}` } } },
  ]);

  return { count: row?.count || 0, oldest: row?.oldest || null };
};

const sections = {
  /* Placed by an agent, not yet confirmed by the office */
  ordersToConfirm: {
    permissions: ["canGetAllOrders", "canConfirmOrders"],
    load: () => countAndOldest(Order, { status: "PLACED" }),
  },

  /* Confirmed, with no delivery partner yet */
  ordersToAssign: {
    permissions: ["canGetAllOrders", "canAssignDelivery"],
    load: () => countAndOldest(Order, { status: "CONFIRMED" }),
  },

  /* With a delivery partner, and no movement for three days */
  ordersStalled: {
    permissions: ["canGetAllOrders", "canAssignDelivery"],
    load: async () => {
      const [row] = await Order.aggregate([
        { $match: { status: { $in: IN_TRANSIT } } },
        { $project: { lastMove: { $max: "$statusHistory.changedAt" } } },
        { $match: { lastMove: { $lt: new Date(Date.now() - STALLED_AFTER_MS) } } },
        { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: "$lastMove" } } },
      ]);

      return { count: row?.count || 0, oldest: row?.oldest || null };
    },
  },

  /* Money owed past its due date, on orders that were not cancelled */
  overdueDues: {
    permissions: ["canSeePaymentInfo"],
    load: async () => {
      const [row] = await Order.aggregate([
        {
          $match: {
            status: { $ne: "CANCELLED" },
            dueAmount: { $gt: 0 },
            dueDate: { $lt: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$dueAmount" },
            oldest: { $min: "$dueDate" },
          },
        },
      ]);

      return {
        count: row?.count || 0,
        amount: roundRupees(row?.amount),
        oldest: row?.oldest || null,
      };
    },
  },

  /* Online payments taken from a customer but not recorded or refunded */
  paymentIssues: {
    permissions: ["canSeePaymentInfo"],
    load: async () => {
      const [row] = await GatewayPayment.aggregate([
        { $match: paymentsNeedingAttention() },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
            oldest: { $min: "$createdAt" },
          },
        },
      ]);

      return {
        count: row?.count || 0,
        amount: roundRupees(row?.amount),
        oldest: row?.oldest || null,
      };
    },
  },

  /* A return an agent raised, with nobody sent to collect it */
  returnsToAssign: {
    permissions: ["canAssignReturn"],
    load: () => countAndOldest(Return, { status: "INITIATED" }),
  },

  /* People who applied to be agents and have had no answer */
  agentApplications: {
    permissions: ["canManageAgents"],
    load: () => countAndOldest(Agent, { status: "PENDING" }),
  },

  /* Approved, but they never set a password, so they cannot sign in: the
     email with the link did not arrive, or the link ran out. "Resend link"
     on the agent's row sends a new one. */
  agentsWithoutPassword: {
    permissions: ["canManageAgents"],
    load: async () => ({
      count: await Agent.countDocuments({
        status: "APPROVED",
        $or: [{ password: { $exists: false } }, { password: null }, { password: "" }],
      }),
    }),
  },

  /* People who applied to be delivery partners and have had no answer */
  partnerApplications: {
    permissions: ["canManageDeliveryPartners"],
    load: () => countAndOldest(DeliveryPartner, { status: "PENDING" }),
  },

  /* Products on sale that are about to run out, or already have */
  lowStock: {
    permissions: ["canManageProducts"],
    load: async () => {
      const filter = { status: "ACTIVE", stock: { $lt: LOW_STOCK } };

      const [count, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).select("name stock uom").sort({ stock: 1 }).limit(5).lean(),
      ]);

      return {
        count,
        outOfStock: products.filter((p) => !(p.stock > 0)).length,
        products: products.map((p) => ({
          _id: p._id,
          name: p.name,
          stock: p.stock,
          uom: p.uom,
        })),
      };
    },
  },

  /* Incentives agents have earned and not been paid */
  incentivesToPay: {
    permissions: ["canPayoutIncentives"],
    load: async () => {
      const [row] = await AgentIncentiveLedger.aggregate([
        {
          $group: {
            _id: "$agentId",
            earned: { $sum: { $cond: [{ $eq: ["$type", "EARNING"] }, "$amount", 0] } },
            paid: { $sum: { $cond: [{ $eq: ["$type", "PAYOUT"] }, "$amount", 0] } },
          },
        },
        { $project: { pending: { $subtract: ["$earned", "$paid"] } } },
        // Above a paisa: float arithmetic leaves dust on a balance paid in full
        { $match: { pending: { $gt: 0.005 } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$pending" } } },
      ]);

      return { count: row?.count || 0, amount: roundRupees(row?.amount) };
    },
  },
};

/**
 * @param {{role: string, permissions?: object}} user  the signed-in caller
 * @returns {Promise<object>} one entry per section the caller may see
 */
export const getAttention = async (user) => {
  const allowed = (keys) =>
    user.role === "ADMIN" ||
    (user.role === "EMPLOYEE" && keys.some((key) => user.permissions?.[key] === true));

  const visible = Object.entries(sections).filter(([, section]) =>
    allowed(section.permissions),
  );

  /* One section failing (a slow aggregate, say) must not blank the rest:
     it is left out, and the others are still shown. */
  const results = await Promise.all(
    visible.map(([key, section]) =>
      section.load().catch((error) => {
        console.error(`ATTENTION SECTION FAILED (${key}):`, error);
        return null;
      }),
    ),
  );

  const data = {};
  visible.forEach(([key], index) => {
    if (results[index]) data[key] = results[index];
  });

  return data;
};
