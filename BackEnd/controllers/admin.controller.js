import Order from "../models/Order.js";
import Store from "../models/store.js";
import Product from "../models/Product.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import crypto from "crypto";
import mongoose from "mongoose";
import Agent from "../models/Agent.js";
import {
  sendAgentApprovalMail,
  sendAgentRejectionMail,
  sendDeliveryPartnerApprovalMail,
  sendDeliveryPartnerRejectionMail,
} from "../utils/email.js";
import { getAdminDashboard } from "../services/dashboard.service.js";

/* The status change is saved before the email goes out. When the email
   failed, the admin used to get an error for a change that had already
   happened, and retrying only said "already approved". The change now
   stands, and the answer says whether the email was sent. */
const trySendEmail = async (label, send) => {
  try {
    await send();
    return true;
  } catch (error) {
    console.error(`${label} EMAIL FAILED:`, error);
    return false;
  }
};

export const approveAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findOne({ agentId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    /* Approved but no password set yet (the email failed, or its link ran
       out): approving again sends a fresh set-password link. */
    const resending = agent.status === "APPROVED";

    if (resending && agent.password) {
      return res.status(400).json({
        success: false,
        message: "Agent already approved",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    agent.status = "APPROVED";
    // Only a hash is stored, as the forgot-password flow already does, so a
    // leaked database copy cannot be used to set this agent's password.
    // The plain token goes out in the email.
    agent.passwordResetToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    agent.passwordResetExpires = Date.now() + 15 * 60 * 1000;

    await agent.save();

    const emailSent = await trySendEmail("AGENT APPROVAL", () =>
      sendAgentApprovalMail({
        email: agent.email,
        agentId: agent.agentId,
        token,
      }),
    );

    res.json({
      success: true,
      emailSent,
      message: emailSent
        ? resending
          ? "A new password setup link has been emailed"
          : "Agent approved & email sent"
        : "Agent approved, but the password setup email could not be sent. Use Resend link to try again.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to approve agent" });
  }
};

// GET ALL AGENTS (ADMIN)
export const getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find()
      .select("-passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: agents.length,
      // Whether a password was ever set, so the panel can offer to resend
      // the setup link to an approved agent who never received or used it.
      // The hash itself is never sent.
      agents: agents.map(({ password, ...agent }) => ({
        ...agent,
        passwordSet: Boolean(password),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents",
    });
  }
};

// REJECT AGENT (ADMIN)
export const rejectAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findOne({ agentId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    if (agent.status === "REJECTED") {
      return res.status(400).json({
        success: false,
        message: "Agent already rejected",
      });
    }

    agent.status = "REJECTED";
    agent.passwordResetToken = undefined;
    agent.passwordResetExpires = undefined;

    await agent.save();

    // 📧 SEND REJECTION EMAIL
    const emailSent = await trySendEmail("AGENT REJECTION", () =>
      sendAgentRejectionMail({
        email: agent.email,
        agentId: agent.agentId,
      }),
    );

    return res.json({
      success: true,
      emailSent,
      message: emailSent
        ? "Agent rejected and email sent"
        : "Agent rejected, but the notification email could not be sent",
    });
  } catch (error) {
    console.error("REJECT AGENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reject agent",
    });
  }
};

// GET DASHBOARD SUMMARY (ADMIN / EMPLOYEE with permission)
export const getDashboardSummary = async (req, res) => {
  try {
    const year = req?.query?.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();

    // 🔥 FIX: an invalid year query param (e.g. "abc") silently became
    // NaN here, which turns into an Invalid Date downstream in
    // getAdminDashboard's date-range queries instead of a clean error.
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: "Invalid year parameter",
      });
    }

    const data = await getAdminDashboard({ year });

    res.json({
      success: true,
      data,
      meta: {
        year,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard",
    });
  }
};

// APPROVE DELIVERY PARTNER APPLICATION
export const approveDeliveryPartner = async (req, res) => {
  try {
    const { partnerId } = req.params; // ✅ FIXED

    // A malformed ID used to throw a cast error and answer 500
    const partner = mongoose.isValidObjectId(partnerId)
      ? await DeliveryPartner.findById(partnerId)
      : null;

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    if (partner.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Already approved",
      });
    }

    partner.status = "ACTIVE";
    await partner.save();

    // No email on file is not a failure: they sign in with their phone
    const emailSent = partner.email
      ? await trySendEmail("DELIVERY PARTNER APPROVAL", () =>
          sendDeliveryPartnerApprovalMail({
            name: partner.name,
            email: partner.email,
          }),
        )
      : null;

    return res.json({
      success: true,
      emailSent,
      message:
        emailSent === false
          ? "Delivery partner approved, but the notification email could not be sent"
          : "Delivery partner approved successfully",
    });
  } catch (error) {
    console.error("APPROVE DELIVERY PARTNER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve delivery partner",
    });
  }
};

// REJECT DELIVERY PARTNER APPLICATION
export const rejectDeliveryPartner = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = mongoose.isValidObjectId(partnerId)
      ? await DeliveryPartner.findById(partnerId)
      : null;

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    if (partner.status === "REJECTED") {
      return res.status(400).json({
        success: false,
        message: "Already rejected",
      });
    }

    partner.status = "REJECTED";
    await partner.save();

    // 📧 Send rejection mail
    const emailSent = partner.email
      ? await trySendEmail("DELIVERY PARTNER REJECTION", () =>
          sendDeliveryPartnerRejectionMail({
            name: partner.name,
            email: partner.email,
          }),
        )
      : null;

    return res.json({
      success: true,
      emailSent,
      message:
        emailSent === false
          ? "Partner rejected, but the notification email could not be sent"
          : "Partner rejected successfully",
    });
  } catch (error) {
    console.error("REJECT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject",
    });
  }
};
