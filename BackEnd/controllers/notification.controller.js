import Notification from "../models/Notification.js";
import Employee from "../models/Employee.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";

export const getMyNotifications = async (req, res) => {
  try {
    const data = await Notification.find({
      recipientId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      isRead: true,
    });

    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    // 🔒 Normalize role (avoid case issues)
    const roleMap = {
      agent: "Agent",
      employee: "Employee",
      deliverypartner: "DeliveryPartner",
    };

    const normalizedRole = roleMap[targetRole.toLowerCase()];

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
    if (normalizedRole === "Agent") {
      users = await Agent.find({ status: "APPROVED" });
    } else if (normalizedRole === "Employee") {
      users = await Employee.find({ status: "ACTIVE" });
    } else if (normalizedRole === "DeliveryPartner") {
      users = await DeliveryPartner.find({ status: "ACTIVE" });
    }

    // ❗ No users found
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No ${normalizedRole}s found`,
      });
    }

    // 📩 BULK NOTIFICATION (with future-proofing)
    const notifications = users.map((user) => ({
      title,
      message,
      recipientId: user._id,
      recipientModel: normalizedRole,
      recipientCode: user.employeeId || user.agentId || user.partnerId || null, // 🔥 future-proof
      senderId: req.user._id,
      type: "CUSTOM",
      meta: {
        broadcast: true,
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
