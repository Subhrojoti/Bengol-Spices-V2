/* =====================================================================
   DELIVERIES: WHERE THE PARTNER WAS, WHAT WENT WRONG, WHO DID WHAT

   Four small things that belong together:

     settings      whether a far-away delivery is refused or only flagged,
                   and how close counts as "at the store"
     the trail     a record of each delivery action (models/DeliveryEvent)
     alerts        what the office should look at: a reported failed
                   delivery, a delivery confirmed away from the store, an
                   order out for delivery for too long
     office moves  ask the partner to try again, allow one delivery without
                   the location check, mark a flag as looked at

   Nothing here follows a partner around. A position is read once, by the
   partner's own phone, at the moment they press a button.
   ===================================================================== */

import mongoose from "mongoose";
import Order from "../models/Order.js";
import Store from "../models/store.js";
import Admin from "../models/Admin.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import DeliverySettings, {
  DEFAULT_RADIUS_METRES,
  MAX_RADIUS_METRES,
  MIN_RADIUS_METRES,
} from "../models/DeliverySettings.js";
import { createNotification } from "./notification.service.js";
import { publish } from "./liveEvents.js";
import { toPoint } from "../utils/geo.js";

// Out for delivery for longer than this is worth a look
export const OUT_FOR_DELIVERY_LONG_MS = 24 * 60 * 60 * 1000;

/* A refused attempt this far from the store was not a phone reading a few
   streets out: someone tried to confirm a delivery from somewhere else. */
const FAR_ATTEMPT_REVIEW_M = 1000;

// The steps at which a partner has the order
export const WITH_PARTNER = ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
// ...and at which they are carrying the goods
export const CARRYING = ["SHIPPED", "OUT_FOR_DELIVERY"];

/* Why a delivery could not be made. The partner picks one; "OTHER" needs a
   few words. Kept short on purpose: a long list is not read on a doorstep. */
export const COULD_NOT_DELIVER_REASONS = {
  STORE_CLOSED: "Store was closed",
  NOBODY_TO_RECEIVE: "Nobody was there to receive it",
  STORE_REFUSED: "Store refused the order",
  STORE_NOT_FOUND: "Could not find the store",
  NO_DELIVERY_CODE: "Store could not give the delivery code",
  LOCATION_NOT_ACCEPTED: "The app would not accept my location at the store",
  OTHER: "Other",
};

export const NOTE_MAX = 300;

const ALERT_PERMISSION = "canAssignDelivery";
const LIST_LIMIT = 200;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const getDeliverySettings = async () => {
  const saved = await DeliverySettings.findOne({ key: "delivery" }).lean();

  return {
    blockFarDeliveries: saved?.blockFarDeliveries === true,
    radiusMetres: saved?.radiusMetres || DEFAULT_RADIUS_METRES,
    limits: { min: MIN_RADIUS_METRES, max: MAX_RADIUS_METRES },
    updatedAt: saved?.updatedAt || null,
    updatedBy: saved?.updatedBy?.name || null,
  };
};

/**
 * @returns {{ error: string } | object} the settings as saved
 */
export const saveDeliverySettings = async ({ blockFarDeliveries, radiusMetres }, by) => {
  const changes = {};

  if (blockFarDeliveries !== undefined) {
    if (typeof blockFarDeliveries !== "boolean") {
      return { error: "Choose whether far-away deliveries are blocked or only flagged." };
    }
    changes.blockFarDeliveries = blockFarDeliveries;
  }

  if (radiusMetres !== undefined) {
    if (
      typeof radiusMetres !== "number" ||
      !Number.isInteger(radiusMetres) ||
      radiusMetres < MIN_RADIUS_METRES ||
      radiusMetres > MAX_RADIUS_METRES
    ) {
      return {
        error: `The distance must be a whole number of metres from ${MIN_RADIUS_METRES} to ${MAX_RADIUS_METRES}.`,
      };
    }
    changes.radiusMetres = radiusMetres;
  }

  if (!Object.keys(changes).length) return { error: "Nothing to change." };

  await DeliverySettings.findOneAndUpdate(
    { key: "delivery" },
    { $set: { ...changes, updatedBy: by }, $setOnInsert: { key: "delivery" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return getDeliverySettings();
};

/* ------------------------------------------------------------------ */
/* Who and where                                                       */
/* ------------------------------------------------------------------ */

/** The signed-in person, as the trail records them. */
export const actorOf = async (user) => {
  if (user.role === "EMPLOYEE") {
    return {
      id: user.employeeId || String(user.id || ""),
      role: "EMPLOYEE",
      name: user.name || "Employee",
    };
  }

  if (user.role === "DELIVERY_PARTNER") {
    let name = user.name;

    if (!name && mongoose.isValidObjectId(user.id)) {
      name = (await DeliveryPartner.findById(user.id).select("name").lean())?.name;
    }

    return { id: String(user.id || ""), role: "DELIVERY_PARTNER", name: name || "Delivery partner" };
  }

  const admin = mongoose.isValidObjectId(user.id)
    ? await Admin.findById(user.id).select("name").lean()
    : null;

  return { id: String(user.id || "admin"), role: "ADMIN", name: admin?.name || "Admin" };
};

/** The store record's delivery code and saved position, for an order. */
export const storeOfOrder = async (order) =>
  (order.store &&
    (await Store.findById(order.store).select("deliveryCode location").lean())) ||
  (await Store.findOne({ consumerId: order.consumerId })
    .select("deliveryCode location")
    .lean());

/* Where the store is. The store's own record first, so a position the
   office has corrected is the one used; otherwise the copy taken when the
   order was placed. */
export const storePointOf = (order, store) =>
  toPoint(store?.location) || toPoint(order.orderLocation);

/* ------------------------------------------------------------------ */
/* The trail                                                           */
/* ------------------------------------------------------------------ */

/**
 * Adds one record to an order's trail. Never throws: the action it records
 * has already happened, and must not be reported as failed because the
 * note about it could not be written.
 */
export const recordDeliveryEvent = async (event) => {
  try {
    const flagged =
      // Delivered somewhere other than the store, or with no way to tell
      (event.action === "DELIVERED" && Boolean(event.problem) && !event.waived) ||
      // Tried from far away, or behind a fake-GPS app, and was refused
      (event.action === "DELIVERY_REFUSED" &&
        (event.problem === "MOCKED" ||
          (event.problem === "TOO_FAR" && event.distance > FAR_ATTEMPT_REVIEW_M)));

    return await DeliveryEvent.create({
      ...event,
      review: { needed: flagged },
    });
  } catch (error) {
    console.error(
      `DELIVERY TRAIL: could not record ${event.action} for ${event.orderId}:`,
      error,
    );
    return null;
  }
};

/** Tells open office panels that the delivery alerts have changed. */
export const announceDeliveryAlert = (payload) =>
  publish("DELIVERY_ALERT", payload, ALERT_PERMISSION);

const partnersById = async (ids) => {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  if (!wanted.length) return {};

  const partners = await DeliveryPartner.find({ _id: { $in: wanted } })
    .select("name phone")
    .lean();

  return Object.fromEntries(partners.map((p) => [String(p._id), p]));
};

const orderSummary = (order, partners) => {
  const partner = partners[String(order.delivery?.partnerId || "")];

  return {
    orderId: order.orderId,
    status: order.status,
    consumerId: order.consumerId,
    storeName: order.deliveryAddress?.storeName || "Store",
    city: order.deliveryAddress?.city || "",
    partner: partner
      ? { id: String(partner._id), name: partner.name, phone: partner.phone }
      : null,
  };
};

/**
 * One order's trail, oldest first, with what is needed to read it: the
 * store, where it is, who has the order now.
 */
export const deliveryTrailOf = async (orderId) => {
  const order = await Order.findOne({ orderId: String(orderId) })
    .select("orderId status consumerId store deliveryAddress orderLocation delivery statusHistory createdAt")
    .lean();

  if (!order) return null;

  const [events, store, partners, settings] = await Promise.all([
    DeliveryEvent.find({ orderId: order.orderId }).sort({ createdAt: 1 }).lean(),
    storeOfOrder(order),
    partnersById([order.delivery?.partnerId]),
    getDeliverySettings(),
  ]);

  return {
    order: {
      ...orderSummary(order, partners),
      placedAt: order.createdAt,
      address: order.deliveryAddress,
      storeLocation: storePointOf(order, store),
      couldNotDeliver: order.delivery?.couldNotDeliver || null,
      locationWaiver: order.delivery?.locationWaiver || null,
      // For an order from before the trail existed: what its history says
      statusHistory: order.statusHistory || [],
    },
    events,
    settings,
    reasons: COULD_NOT_DELIVER_REASONS,
  };
};

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

const couldNotDeliverFilter = () => ({
  status: { $in: CARRYING },
  "delivery.couldNotDeliver.at": { $exists: true },
});

const outForDeliveryLongPipeline = () => [
  { $match: { status: "OUT_FOR_DELIVERY" } },
  // Its last move was going out for delivery; that is when the clock started
  { $addFields: { since: { $max: "$statusHistory.changedAt" } } },
  { $match: { since: { $lt: new Date(Date.now() - OUT_FOR_DELIVERY_LONG_MS) } } },
];

/* The three counts for the dashboard. Each one is a list on the Delivery
   page's Alerts tab. */
export const deliveryAlertCounts = {
  couldNotDeliver: async () => {
    const [row] = await Order.aggregate([
      { $match: couldNotDeliverFilter() },
      { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: "$delivery.couldNotDeliver.at" } } },
    ]);
    return { count: row?.count || 0, oldest: row?.oldest || null };
  },

  locationFlags: async () => {
    const [row] = await DeliveryEvent.aggregate([
      { $match: { "review.needed": true } },
      { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: "$createdAt" } } },
    ]);
    return { count: row?.count || 0, oldest: row?.oldest || null };
  },

  outForDeliveryLong: async () => {
    const [row] = await Order.aggregate([
      ...outForDeliveryLongPipeline(),
      { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: "$since" } } },
    ]);
    return {
      count: row?.count || 0,
      oldest: row?.oldest || null,
      afterHours: OUT_FOR_DELIVERY_LONG_MS / 3600000,
    };
  },
};

/** Everything on the Alerts tab, in one read. */
export const listDeliveryAlerts = async () => {
  const [failed, flags, long, settings] = await Promise.all([
    Order.find(couldNotDeliverFilter())
      .select("orderId status consumerId deliveryAddress delivery")
      .sort({ "delivery.couldNotDeliver.at": 1 })
      .limit(LIST_LIMIT)
      .lean(),
    DeliveryEvent.find({ "review.needed": true })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    Order.aggregate([
      ...outForDeliveryLongPipeline(),
      { $sort: { since: 1 } },
      { $limit: LIST_LIMIT },
      { $project: { orderId: 1, status: 1, consumerId: 1, deliveryAddress: 1, delivery: 1, since: 1 } },
    ]),
    getDeliverySettings(),
  ]);

  const flaggedOrders = await Order.find({
    orderId: { $in: [...new Set(flags.map((f) => f.orderId))] },
  })
    .select("orderId status consumerId deliveryAddress delivery")
    .lean();
  const flaggedById = Object.fromEntries(flaggedOrders.map((o) => [o.orderId, o]));

  const partners = await partnersById([
    ...failed.map((o) => o.delivery?.partnerId),
    ...long.map((o) => o.delivery?.partnerId),
    ...flaggedOrders.map((o) => o.delivery?.partnerId),
  ]);

  // Where the partner was when they reported each failed attempt
  const reports = await DeliveryEvent.find({
    orderId: { $in: failed.map((o) => o.orderId) },
    action: "COULD_NOT_DELIVER",
  })
    .sort({ createdAt: -1 })
    .select("orderId distance problem location createdAt")
    .lean();
  const lastReport = {};
  reports.forEach((r) => {
    lastReport[r.orderId] ??= r;
  });

  return {
    settings,
    reasons: COULD_NOT_DELIVER_REASONS,

    couldNotDeliver: failed.map((order) => {
      const report = order.delivery.couldNotDeliver;
      const event = lastReport[order.orderId];

      return {
        ...orderSummary(order, partners),
        reason: report.reason,
        reasonLabel: COULD_NOT_DELIVER_REASONS[report.reason] || report.reason,
        note: report.note || "",
        at: report.at,
        distance: event?.distance ?? null,
        problem: event?.problem || null,
        location: event?.location || null,
      };
    }),

    locationFlags: flags.map((event) => {
      const order = flaggedById[event.orderId];

      return {
        ...(order
          ? orderSummary(order, partners)
          : { orderId: event.orderId, storeName: "Store", city: "", partner: null }),
        eventId: String(event._id),
        action: event.action,
        problem: event.problem,
        distance: event.distance ?? null,
        allowed: event.allowed ?? null,
        at: event.createdAt,
        partnerName: event.partnerName || event.by?.name || null,
        location: event.location || null,
        storeLocation: event.storeLocation || null,
      };
    }),

    outForDeliveryLong: long.map((order) => ({
      ...orderSummary(order, partners),
      since: order.since,
      afterHours: OUT_FOR_DELIVERY_LONG_MS / 3600000,
    })),
  };
};

/* ------------------------------------------------------------------ */
/* Office moves                                                        */
/* ------------------------------------------------------------------ */

/** Marks a flagged record as looked at. */
export const reviewDeliveryEvent = async (eventId, by) => {
  if (!mongoose.isValidObjectId(eventId)) return null;

  return DeliveryEvent.findOneAndUpdate(
    { _id: eventId, "review.needed": true },
    { $set: { "review.needed": false, "review.at": new Date(), "review.by": by } },
    { new: true },
  ).lean();
};

const notifyPartner = (order, title, message) =>
  createNotification({
    title,
    message,
    recipientId: order.delivery.partnerId,
    recipientModel: "DeliveryPartner",
    meta: { orderId: order.orderId },
  }).catch((error) => console.error("DELIVERY NOTIFICATION FAILED:", error));

/**
 * The office has read a "could not deliver" report and wants the same
 * partner to try again: the report is closed and the partner is told.
 *
 * @returns {{ status: number, message: string }}
 */
export const requestDeliveryRetry = async (orderId, by) => {
  const order = await Order.findOneAndUpdate(
    { orderId: String(orderId), ...couldNotDeliverFilter() },
    { $unset: { "delivery.couldNotDeliver": "" } },
    { new: true },
  ).lean();

  if (!order) {
    return {
      status: 409,
      message: "This order has no open failed-delivery report. Refresh to see where it stands.",
    };
  }

  await recordDeliveryEvent({
    orderId: order.orderId,
    action: "RETRY_REQUESTED",
    by,
    partnerId: order.delivery.partnerId,
  });

  await notifyPartner(
    order,
    "Try this delivery again",
    `The office has asked you to try delivering order ${order.orderId} again.`,
  );

  return { status: 200, message: `${order.orderId}: the partner has been asked to try again` };
};

/**
 * The office allows one order to be marked delivered without the location
 * check: the store's saved position is wrong, or the partner's phone cannot
 * get a reading there. The store's delivery code is still needed. Any open
 * failed-delivery report is closed, since this is the answer to it.
 */
export const waiveLocationCheck = async (orderId, by) => {
  const order = await Order.findOneAndUpdate(
    {
      orderId: String(orderId),
      status: { $in: WITH_PARTNER },
      "delivery.partnerId": { $exists: true, $ne: null },
    },
    {
      $set: { "delivery.locationWaiver": { at: new Date(), by } },
      $unset: { "delivery.couldNotDeliver": "" },
    },
    { new: true },
  ).lean();

  if (!order) {
    return {
      status: 409,
      message: "Only an order that is with a delivery partner can be allowed this way.",
    };
  }

  await recordDeliveryEvent({
    orderId: order.orderId,
    action: "LOCATION_CHECK_WAIVED",
    by,
    partnerId: order.delivery.partnerId,
  });

  await notifyPartner(
    order,
    "Delivery allowed without location check",
    `The office has allowed order ${order.orderId} to be marked delivered without the location check. You still need the store's delivery code.`,
  );

  return {
    status: 200,
    message: `${order.orderId} can now be marked delivered without the location check`,
  };
};
