import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { sendPasswordResetMail } from "../utils/email.js";
import { frontendBaseUrl } from "../utils/frontendUrl.js";

// Generate link for the Password

export const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    /* 🔥 FIX: token went into the query exactly as sent. Sending an object
       such as {"$ne": null} instead of a string matched ANY agent holding a
       live link — including one generated moments earlier by requesting
       "forgot password" for someone else's agent ID — and set that agent's
       password. Only a plain string is accepted now. */
    if (typeof token !== "string" || !token || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    if (!STRONG_PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters long and contain letters and numbers",
      });
    }

    // Approval links now store only a hash of the token. The plain match
    // keeps links sent before this change working until they expire.
    const agent = await Agent.findOne({
      $or: [
        { passwordResetToken: hashResetToken(token) },
        { passwordResetToken: token },
      ],
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!agent) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    agent.password = await bcrypt.hash(password, 10);
    agent.passwordResetToken = undefined;
    agent.passwordResetExpires = undefined;
    agent.passwordChangedAt = new Date();

    await agent.save();
    res.json({
      success: true,
      message: "Password set successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// Agent Login JWT Authorization

export const agentLogin = async (req, res) => {
  try {
    const { agentId, password } = req.body;

    // Strings only: an object here would be read as a query operator
    if (
      typeof agentId !== "string" ||
      typeof password !== "string" ||
      !agentId.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Agent ID and password are required",
      });
    }

    // Agent IDs are issued in capitals (BS2026-001); forgive the case typed
    const agent = await Agent.findOne({
      agentId: agentId.trim().toUpperCase(),
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    if (agent.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Agent not approved yet",
      });
    }

    // Approved but the set-password link was never used: bcrypt would throw
    // on the missing hash and the agent would only see a server error
    if (!agent.password) {
      return res.status(403).json({
        success: false,
        message:
          "Your password has not been set yet. Use the link in your approval email, or Forgot password.",
      });
    }

    const isMatch = await bcrypt.compare(password, agent.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: agent._id, // MongoDB _id (internal use)
        agentId: agent.agentId, // BS2026-001 (business use)
        role: agent.role, // AGENT / ADMIN
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      success: true,
      token,
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// CHANGE PASSWORD (AGENT)
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // 1️⃣ Required fields check
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password, new password and confirm password are required",
      });
    }

    // 2️⃣ Confirm password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    // 3️⃣ Strong password validation
    // Minimum 6 characters, at least 1 letter and 1 number
    const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters long and contain letters and numbers",
      });
    }

    // req.user.id comes from JWT (protect middleware)
    const agent = await Agent.findById(req.user.id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // 4️⃣ Old password check
    const isMatch = await bcrypt.compare(oldPassword, agent.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    // 5️⃣ Prevent using same password again
    const isSamePassword = await bcrypt.compare(newPassword, agent.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as old password",
      });
    }

    // 6️⃣ Hash and save new password
    agent.password = await bcrypt.hash(newPassword, 10);
    await agent.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

// LOGOUT (Agent / Admin)
export const logout = async (req, res) => {
  try {
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// EMPLOYEE LOGIN
export const employeeLogin = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (
      typeof employeeId !== "string" ||
      typeof password !== "string" ||
      !employeeId.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and password are required",
      });
    }

    const employee = await Employee.findOne({
      employeeId: employeeId.trim().toUpperCase(),
    });

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (employee.status === "INACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    if (employee.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, employee.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: employee._id,
        role: employee.role,
        employeeId: employee.employeeId,
        name: employee.name,
        permissions: employee.permissions, // 🔥 important
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // 🔥 Mark online
    employee.isOnline = true;
    await employee.save();

    return res.json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("EMPLOYEE LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// EMPLOYEE LOGOUT
export const employeeLogout = async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    employee.isOnline = false;
    await employee.save();

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("EMPLOYEE LOGOUT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

/* =====================================================================
   FORGOT / RESET PASSWORD (AGENT + DELIVERY PARTNER)
   Flow:
     1. POST forgot-password  -> email a one-time reset link (15 min)
     2. POST reset-password   -> verify token, set new password
   The raw token goes in the email; only its SHA-256 hash is stored.
   ===================================================================== */

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESET_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between emails
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Generic response so callers cannot enumerate accounts
const GENERIC_FORGOT_MESSAGE =
  "If an account matching those details exists, a password reset link has been sent to the registered email.";

/**
 * Shared implementation for both roles.
 * @param {object} opts
 * @param {import("mongoose").Document|null} opts.user  matched account (or null)
 * @param {string} opts.roleLabel  "Agent" | "Delivery Partner"
 * @param {string} opts.resetPath  frontend path that hosts the reset form
 */
const issuePasswordReset = async ({ user, roleLabel, resetPath }, res) => {
  // Unknown account -> still respond 200 (no enumeration)
  if (!user) {
    return res.json({ success: true, message: GENERIC_FORGOT_MESSAGE });
  }

  // Account exists but has no email we can send to
  if (!user.email) {
    return res.status(400).json({
      success: false,
      message:
        "No email address is registered with this account. Please contact support to reset your password.",
    });
  }

  // Cooldown: a link was issued less than a minute ago, do not resend
  if (
    user.passwordResetExpires &&
    user.passwordResetExpires.getTime() - Date.now() >
      RESET_TOKEN_TTL_MS - RESET_RESEND_COOLDOWN_MS
  ) {
    return res.json({ success: true, message: GENERIC_FORGOT_MESSAGE });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");

  user.passwordResetToken = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const link = `${frontendBaseUrl()}${resetPath}?token=${rawToken}`;

  try {
    await sendPasswordResetMail({
      name: user.name,
      email: user.email,
      link,
      roleLabel,
    });
  } catch (mailError) {
    // Roll back so the user can retry immediately
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    console.error("PASSWORD RESET MAIL ERROR:", mailError);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset email. Please try again.",
    });
  }

  return res.json({ success: true, message: GENERIC_FORGOT_MESSAGE });
};

/**
 * Shared reset implementation for both roles.
 * @param {import("mongoose").Model} Model
 */
const applyPasswordReset = async (Model, req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || typeof password !== "string" || !password) {
    return res.status(400).json({
      success: false,
      message: "Token and new password are required",
    });
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New password and confirm password do not match",
    });
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 6 characters long and contain letters and numbers",
    });
  }

  const user = await Model.findOne({
    passwordResetToken: hashResetToken(String(token)),
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset link. Please request a new one.",
    });
  }

  if (user.password && (await bcrypt.compare(password, user.password))) {
    return res.status(400).json({
      success: false,
      message: "New password cannot be the same as your old password",
    });
  }

  user.password = await bcrypt.hash(password, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // Anyone still logged in with the old password is signed out
  user.passwordChangedAt = new Date();
  await user.save();

  return res.json({
    success: true,
    message: "Password reset successfully. You can now log in.",
  });
};

// POST /auth/agent/forgot-password   body: { agentId } or { email }
export const agentForgotPassword = async (req, res) => {
  try {
    const { agentId, email } = req.body;

    if (!agentId && !email) {
      return res.status(400).json({
        success: false,
        message: "Agent ID or registered email is required",
      });
    }

    const query = agentId
      ? { agentId: String(agentId).trim().toUpperCase() }
      : { email: String(email).trim().toLowerCase() };

    /* Agent emails were saved exactly as typed, so "Ravi@Gmail.com" never
       matched the lower-cased lookup and that agent could not reset by
       email. The collation compares without regard to case. */
    const agent = await Agent.findOne(query).collation({
      locale: "en",
      strength: 2,
    });

    // Only approved agents have a password to reset
    if (agent && agent.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not approved yet. Password reset is available only after approval.",
      });
    }

    return await issuePasswordReset(
      { user: agent, roleLabel: "Agent", resetPath: "/agent-reset-password" },
      res,
    );
  } catch (error) {
    console.error("AGENT FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
    });
  }
};

// POST /auth/agent/reset-password   body: { token, password, confirmPassword }
export const agentResetPassword = async (req, res) => {
  try {
    return await applyPasswordReset(Agent, req, res);
  } catch (error) {
    console.error("AGENT RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// POST /auth/delivery-partner/forgot-password   body: { phone }
export const deliveryPartnerForgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Registered phone number is required",
      });
    }

    const partner = await DeliveryPartner.findOne({
      phone: String(phone).trim(),
    });

    if (partner && partner.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not active. Password reset is available only for approved accounts.",
      });
    }

    return await issuePasswordReset(
      {
        user: partner,
        roleLabel: "Delivery Partner",
        resetPath: "/delivery-reset-password",
      },
      res,
    );
  } catch (error) {
    console.error("DELIVERY PARTNER FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
    });
  }
};

// POST /auth/delivery-partner/reset-password   body: { token, password, confirmPassword }
export const deliveryPartnerResetPassword = async (req, res) => {
  try {
    return await applyPasswordReset(DeliveryPartner, req, res);
  } catch (error) {
    console.error("DELIVERY PARTNER RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};
