import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";

// Generate link for the Password

export const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const agent = await Agent.findOne({
      passwordResetToken: token,
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

    if (!agentId || !password) {
      return res.status(400).json({
        success: false,
        message: "Agent ID and password are required",
      });
    }

    const agent = await Agent.findOne({ agentId });

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

    if (!employeeId || !password) {
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
