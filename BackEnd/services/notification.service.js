import Notification from "../models/Notification.js";
import Employee from "../models/Employee.js";
import Agent from "../models/Agent.js";
import mongoose from "mongoose";

export const createNotification = async ({
  title,
  message,
  recipientId,
  recipientModel,
  senderId = null,
  type = "SYSTEM",
  meta = {},
}) => {
  let finalRecipientId = recipientId;
  let recipientCode = null;

  try {
    // ✅ Handle Employee conversion
    if (recipientModel === "Employee") {
      // If already ObjectId → use directly
      if (mongoose.Types.ObjectId.isValid(recipientId)) {
        const employee = await Employee.findById(recipientId);
        if (employee) {
          recipientCode = employee.employeeId;
        }
      } else {
        // 🔥 Convert EMP2026-009 → ObjectId
        const employee = await Employee.findOne({
          employeeId: recipientId,
        });

        if (!employee) {
          throw new Error("Employee not found for notification");
        }

        finalRecipientId = employee._id;
        recipientCode = employee.employeeId;
      }
    }

    if (recipientModel === "Agent") {
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        const agent = await Agent.findOne({ agentId: recipientId });

        if (!agent) {
          throw new Error("Agent not found for notification");
        }

        finalRecipientId = agent._id;
        recipientCode = agent.agentId;
      }
    }

    return await Notification.create({
      title,
      message,
      recipientId: finalRecipientId,
      recipientCode, // ✅ new field
      recipientModel,
      senderId,
      type,
      meta,
    });
  } catch (error) {
    console.error("Notification Error:", error.message);
    throw error;
  }
};

export const sendBulkNotification = async ({
  users,
  title,
  message,
  senderId,
  type = "CUSTOM",
}) => {
  const data = users.map((user) => ({
    title,
    message,
    recipientId: user._id,
    recipientModel: user.role,
    senderId,
    type,
  }));

  return await Notification.insertMany(data);
};
