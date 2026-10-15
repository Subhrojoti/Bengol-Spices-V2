import Order from "../models/Order.js";
import {
  CARRYING,
  COULD_NOT_DELIVER_REASONS,
  NOTE_MAX,
  actorOf,
  announceDeliveryAlert,
  deliveryTrailOf,
  getDeliverySettings,
  listDeliveryAlerts,
  recordDeliveryEvent,
  requestDeliveryRetry,
  reviewDeliveryEvent,
  saveDeliverySettings,
  storeOfOrder,
  storePointOf,
  waiveLocationCheck,
} from "../services/deliveryTrail.service.js";
import { checkAtStore, readLocation } from "../utils/geo.js";

const fail = (res, action, error, message) => {
  console.error(`${action}:`, error);
  return res.status(500).json({ success: false, message });
};

/* =====================================================================
   DELIVERY PARTNER
   ===================================================================== */

/* "Could not deliver": the partner went (or tried to go) and the order
   could not be handed over. They say why; the office decides what happens
   next. The order itself does not move: the partner still has the goods,
   and can still deliver it if the store opens after all. */
export const reportCouldNotDeliver = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (typeof reason !== "string" || !Object.hasOwn(COULD_NOT_DELIVER_REASONS, reason)) {
      return res.status(400).json({
        success: false,
        message: "Choose why the order could not be delivered",
      });
    }

    if (req.body.note !== undefined && typeof req.body.note !== "string") {
      return res.status(400).json({ success: false, message: "The note must be text" });
    }

    const note = (req.body.note || "").trim();

    if (note.length > NOTE_MAX) {
      return res.status(400).json({
        success: false,
        message: `Keep the note under ${NOTE_MAX} characters`,
      });
    }

    if (reason === "OTHER" && note.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Say in a few words what happened",
      });
    }

    const order = await Order.findOne({ orderId: String(orderId) });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (
      !order.delivery?.partnerId ||
      order.delivery.partnerId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this order",
      });
    }

    if (!CARRYING.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          order.status === "ASSIGNED"
            ? "Mark the order as shipped first. Only an order you are carrying can be reported."
            : "This order is no longer out for delivery",
      });
    }

    const now = new Date();

    // Still theirs and still on its way, or nothing is recorded
    const reported = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        "delivery.partnerId": order.delivery.partnerId,
      },
      { $set: { "delivery.couldNotDeliver": { reason, note, at: now } } },
      { new: true },
    );

    if (!reported) {
      return res.status(409).json({
        success: false,
        message:
          "This order was changed a moment ago. Refresh to see where it stands.",
      });
    }

    /* Where they were when they reported it. Never a reason to refuse the
       report; the office sees the distance beside it. */
    const location = readLocation(req.body.location);
    const [settings, store, actor] = await Promise.all([
      getDeliverySettings(),
      storeOfOrder(order),
      actorOf(req.user),
    ]);
    const storeLocation = storePointOf(order, store);
    const place = checkAtStore(location, storeLocation, settings.radiusMetres);

    await recordDeliveryEvent({
      orderId: order.orderId,
      action: "COULD_NOT_DELIVER",
      by: actor,
      partnerId: order.delivery.partnerId,
      partnerName: actor.name,
      location: location || undefined,
      storeLocation: storeLocation || undefined,
      distance: place.distance ?? undefined,
      allowed: settings.radiusMetres,
      problem: place.problem || undefined,
      reason,
      note: note || undefined,
    });

    announceDeliveryAlert({
      kind: "COULD_NOT_DELIVER",
      orderId: order.orderId,
      storeName: order.deliveryAddress?.storeName,
      partnerName: actor.name,
      reason: COULD_NOT_DELIVER_REASONS[reason],
    });

    return res.json({
      success: true,
      message: "Reported. The office has been told and will decide what happens next.",
    });
  } catch (error) {
    return fail(res, "COULD NOT DELIVER ERROR", error, "Failed to send the report");
  }
};

/* =====================================================================
   OFFICE (admin, or an employee who assigns deliveries)
   ===================================================================== */

// What needs a look: failed deliveries, far-from-store flags, long-running ones
export const getDeliveryAlerts = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, data: await listDeliveryAlerts() });
  } catch (error) {
    return fail(res, "DELIVERY ALERTS ERROR", error, "Failed to load delivery alerts");
  }
};

// One order's delivery trail: who did what, when, and where
export const getDeliveryTrail = async (req, res) => {
  try {
    const data = await deliveryTrailOf(req.params.orderId);

    if (!data) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, data });
  } catch (error) {
    return fail(res, "DELIVERY TRAIL ERROR", error, "Failed to load the delivery trail");
  }
};

// A flagged record has been looked at
export const markDeliveryEventReviewed = async (req, res) => {
  try {
    const event = await reviewDeliveryEvent(req.params.eventId, await actorOf(req.user));

    if (!event) {
      return res.status(409).json({
        success: false,
        message: "This has already been reviewed. Refresh to see the list as it stands.",
      });
    }

    return res.json({ success: true, message: "Marked as reviewed" });
  } catch (error) {
    return fail(res, "DELIVERY REVIEW ERROR", error, "Failed to mark this as reviewed");
  }
};

// Ask the same partner to try a failed delivery again
export const retryDelivery = async (req, res) => {
  try {
    const result = await requestDeliveryRetry(req.params.orderId, await actorOf(req.user));
    return res
      .status(result.status)
      .json({ success: result.status === 200, message: result.message });
  } catch (error) {
    return fail(res, "DELIVERY RETRY ERROR", error, "Failed to ask for another attempt");
  }
};

// Allow one order to be marked delivered without the location check
export const allowWithoutLocation = async (req, res) => {
  try {
    const result = await waiveLocationCheck(req.params.orderId, await actorOf(req.user));
    return res
      .status(result.status)
      .json({ success: result.status === 200, message: result.message });
  } catch (error) {
    return fail(res, "LOCATION WAIVER ERROR", error, "Failed to allow this delivery");
  }
};

export const getSettings = async (req, res) => {
  try {
    return res.json({ success: true, data: await getDeliverySettings() });
  } catch (error) {
    return fail(res, "DELIVERY SETTINGS ERROR", error, "Failed to load delivery settings");
  }
};

// Admin only: block far-away deliveries or only flag them, and the distance
export const updateSettings = async (req, res) => {
  try {
    const { blockFarDeliveries, radiusMetres } = req.body || {};
    const result = await saveDeliverySettings(
      { blockFarDeliveries, radiusMetres },
      await actorOf(req.user),
    );

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    return res.json({ success: true, message: "Delivery settings saved", data: result });
  } catch (error) {
    return fail(res, "DELIVERY SETTINGS ERROR", error, "Failed to save delivery settings");
  }
};
