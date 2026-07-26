import Order from "../models/Order.js";
import Store from "../models/store.js";
import Product from "../models/Product.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import crypto from "crypto";
import Agent from "../models/Agent.js";
import {
  sendAgentApprovalMail,
  sendAgentRejectionMail,
  sendDeliveryPartnerApprovalMail,
  sendDeliveryPartnerRejectionMail,
} from "../utils/email.js";
import { getAdminDashboard } from "../services/dashboard.service.js";

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

    if (agent.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Agent already approved",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    agent.status = "APPROVED";
    agent.passwordResetToken = token;
    agent.passwordResetExpires = Date.now() + 15 * 60 * 1000;

    await agent.save();

    await sendAgentApprovalMail({
      email: agent.email,
      agentId: agent.agentId,
      token,
    });

    res.json({
      success: true,
      message: "Agent approved & email sent",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

// GET ALL AGENTS (ADMIN)
export const getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find()
      .select("-password -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: agents.length,
      agents,
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
    await sendAgentRejectionMail({
      email: agent.email,
      agentId: agent.agentId,
    });

    return res.json({
      success: true,
      message: "Agent rejected and email sent",
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

    const partner = await DeliveryPartner.findById(partnerId);

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

    if (partner.email) {
      await sendDeliveryPartnerApprovalMail({
        name: partner.name,
        email: partner.email,
      });
    }

    return res.json({
      success: true,
      message: "Delivery partner approved successfully",
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

    const partner = await DeliveryPartner.findById(partnerId); // ✅ FIXED

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
    if (partner.email) {
      await sendDeliveryPartnerRejectionMail({
        name: partner.name,
        email: partner.email,
      });
    }

    return res.json({
      success: true,
      message: "Partner rejected successfully",
    });
  } catch (error) {
    console.error("REJECT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject",
    });
  }
};
