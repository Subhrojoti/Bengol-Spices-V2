import crypto from "crypto";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import Employee from "../models/Employee.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";

// The newest this many; nobody scrolls further, and an account that has
// been receiving them for years would otherwise download the whole lot on
// every visit
const NOTIFICATION_LIMIT = 300;

export const getMyNotifications = async (req, res) => {
  try {
    /* Admin has no account record, so no id and no notifications of its
       own. Said outright rather than left to how the database happens to
       treat a search for "no id". */
    if (!req.user._id) return res.json([]);

    const data = await Notification.find({
      recipientId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_LIMIT);

    res.json(data);
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    // 🔒 FIX: any account could mark anyone's notification as read. Only the
    // recipient can now; admin, which has no account record, as before.
    // A malformed id used to reach the database and answer 500
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const filter =
      req.user.role === "ADMIN"
        ? { _id: req.params.id }
        : { _id: req.params.id, recipientId: req.user._id };

    await Notification.findOneAndUpdate(filter, {
      isRead: true,
    });

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    res.status(500).json({ error: "Failed to update the notification" });
  }
};

export const sendCustomNotification = async (req, res) => {
  try {
    const { targetRole, title, message } = req.body;

    // 🔒 VALIDATION
    if (!targetRole || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "targetRole, title and message are required",
      });
    }

    // 🔥 A title or message of only spaces passed the check above and was
    // then broadcast to everyone as a blank notification, with no way to
    // recall it.
    const cleanTitle = String(title).trim();
    const cleanMessage = String(message).trim();

    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Title and message cannot be blank",
      });
    }

    if (cleanTitle.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Title must be 120 characters or fewer",
      });
    }

    if (cleanMessage.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Message must be 1000 characters or fewer",
      });
    }

    // 🔒 Normalize role (avoid case issues)
    const roleMap = {
      agent: "Agent",
      employee: "Employee",
      deliverypartner: "DeliveryPartner",
    };

    // String(): a non-text targetRole used to throw here and answer 500
    const normalizedRole = roleMap[String(targetRole).toLowerCase()];

    if (!normalizedRole) {
      return res.status(400).json({
        success: false,
        message: "Invalid targetRole",
      });
    }

    // 🔒 PERMISSION RULE
    // 🔥 FIX: Employee.role is always stored/signed into the JWT as
    // "EMPLOYEE" (all caps) — this was comparing against "Employee",
    // which could never match, so this rule never actually fired and
    // employees could freely notify other employees.
    if (req.user.role === "EMPLOYEE" && normalizedRole === "Employee") {
      return res.status(403).json({
        success: false,
        message: "Employees cannot send notifications to employees",
      });
    }

    let users = [];

    // 🎯 FETCH USERS
    // Only the ids are needed, not every applicant's documents and bank details
    if (normalizedRole === "Agent") {
      users = await Agent.find({ status: "APPROVED" }).select("_id agentId").lean();
    } else if (normalizedRole === "Employee") {
      users = await Employee.find({ status: "ACTIVE" }).select("_id employeeId").lean();
    } else if (normalizedRole === "DeliveryPartner") {
      users = await DeliveryPartner.find({ status: "ACTIVE" }).select("_id").lean();
    }

    // ❗ No users found
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No ${normalizedRole}s found`,
      });
    }

    // 📩 BULK NOTIFICATION (with future-proofing)
    // One ID for the whole send, so the history lists it as one broadcast
    const broadcastId = crypto.randomUUID();
    const notifications = users.map((user) => ({
      title: cleanTitle,
      message: cleanMessage,
      recipientId: user._id,
      recipientModel: normalizedRole,
      recipientCode: user.employeeId || user.agentId || user.partnerId || null, // 🔥 future-proof
      senderId: req.user._id,
      type: "CUSTOM",
      meta: {
        broadcast: true,
        broadcastId,
        senderRole: req.user.role,
      },
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: `Notification sent to all ${normalizedRole}s`,
      count: notifications.length,
    });
  } catch (error) {
    console.error("CUSTOM NOTIFICATION ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
    });
  }
};

/**
 * How many people each role would actually reach.
 *
 * Counts use the same filters sendCustomNotification does, so the number
 * shown before sending is the number that will be written. A broadcast goes
 * to everyone at once and cannot be recalled, so the panel showed no idea of
 * its own blast radius before this.
 */
export const getNotificationAudience = async (req, res) => {
  try {
    const [agents, employees, deliveryPartners] = await Promise.all([
      Agent.countDocuments({ status: "APPROVED" }),
      Employee.countDocuments({ status: "ACTIVE" }),
      DeliveryPartner.countDocuments({ status: "ACTIVE" }),
    ]);

    return res.json({
      success: true,
      audience: {
        Agent: agents,
        Employee: employees,
        DeliveryPartner: deliveryPartners,
      },
    });
  } catch (error) {
    console.error("NOTIFICATION AUDIENCE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to count the audience",
    });
  }
};

/**
 * History of custom broadcasts, newest first.
 *
 * One send fans out into a row per recipient, so they are regrouped by
 * title, message, audience and the minute they went out. Each entry carries
 * how many people received it and how many have read it — previously a
 * broadcast vanished the moment it was sent, with no record and no way to
 * tell whether anyone saw it.
 *
 * Only genuine broadcasts are included: system notifications (a new target,
 * an approval) do not set meta.broadcast and stay out of this list.
 */
export const getSentNotifications = async (req, res) => {
  try {
    const grouped = await Notification.aggregate([
      { $match: { type: "CUSTOM", "meta.broadcast": true } },
      {
        $group: {
          /* Grouped by the send itself. Broadcasts from before broadcastId
             existed fall back to title, message, audience and minute — which
             split one large send in two when it crossed a minute. */
          _id: {
            $ifNull: [
              "$meta.broadcastId",
              {
                title: "$title",
                message: "$message",
                recipientModel: "$recipientModel",
                minute: {
                  $dateToString: {
                    format: "%Y-%m-%dT%H:%M",
                    date: "$createdAt",
                  },
                },
              },
            ],
          },
          title: { $first: "$title" },
          message: { $first: "$message" },
          recipientModel: { $first: "$recipientModel" },
          recipients: { $sum: 1 },
          readCount: { $sum: { $cond: ["$isRead", 1, 0] } },
          sentAt: { $min: "$createdAt" },
          senderRole: { $first: "$meta.senderRole" },
        },
      },
      { $sort: { sentAt: -1 } },
      { $limit: 50 },
    ]);

    const data = grouped.map((g) => ({
      title: g.title,
      message: g.message,
      audience: g.recipientModel,
      sentAt: g.sentAt,
      senderRole: g.senderRole || null,
      recipients: g.recipients,
      readCount: g.readCount,
    }));

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("SENT NOTIFICATIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent notifications",
    });
  }
};
