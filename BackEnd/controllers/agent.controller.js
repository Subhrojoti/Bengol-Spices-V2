import Agent from "../models/Agent.js";
import { sendAdminNotification } from "../utils/email.js";
import cloudinary from "../config/cloudinary.js";
import AgentSalesLocation from "../models/AgentSalesLocation.js";
import { getAgentDashboard } from "../services/dashboard.service.js";
import { getLeaderboard } from "../services/leaderboard.service.js";
import Counter from "../models/Counter.js";
import DeliveryPartner from "../models/DeliveryPartner.js";

// Same day one month earlier, clamped to that month's last day
const oneMonthBefore = (date) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

const cleanupCloudinaryFiles = async (files) => {
  if (!files) return;

  const allFiles = [];

  Object.values(files).forEach((fileArr) => {
    fileArr.forEach((file) => {
      if (file.filename) {
        allFiles.push(file.filename);
      }
    });
  });

  for (const publicId of allFiles) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error("Failed to delete file:", publicId);
    }
  }
};

// AGENT - APPLY
export const applyAgent = async (req, res) => {
  let uploadedFiles = req.files;

  try {
    /* =============================
       FILE HANDLING
    ============================= */
    const files = uploadedFiles || [];

    const getFilePath = (fieldName) => {
      if (Array.isArray(files)) {
        return files.find((f) => f.fieldname === fieldName)?.path;
      }
      return files[fieldName]?.[0]?.path;
    };

    const aadhaarPath = getFilePath("aadhaar");
    const panPath = getFilePath("pan");
    const photoPath = getFilePath("photo");

    if (!aadhaarPath || !panPath || !photoPath) {
      // Whichever of the three did arrive would otherwise stay on Cloudinary
      await cleanupCloudinaryFiles(uploadedFiles);

      return res.status(400).json({
        success: false,
        message: "All documents are required",
      });
    }

    /* =============================
       BODY DATA
    ============================= */
    const {
      name,
      email,
      phone,
      address,
      state,
      city,
      street,
      pincode,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
    } = req.body;

    /* =============================
       BASIC VALIDATION
    ============================= */
    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !state ||
      !city ||
      !street ||
      !pincode
    ) {
      await cleanupCloudinaryFiles(uploadedFiles);

      return res.status(400).json({
        success: false,
        message: "All fields including full address are required",
      });
    }

    /* =============================
       BANK VALIDATION
    ============================= */
    const hasAnyBankField =
      accountHolderName || accountNumber || ifscCode || bankName;

    const hasAllBankFields =
      accountHolderName && accountNumber && ifscCode && bankName;

    if (hasAnyBankField && !hasAllBankFields) {
      await cleanupCloudinaryFiles(uploadedFiles);

      return res.status(400).json({
        success: false,
        message: "Please provide complete bank details",
      });
    }

    /* =============================
       CHECK EXISTING EMAIL & PHONE
       ============================= */
    // 🔥 FIX: trim before checking. findOne() doesn't apply the schema's
    // trim to the query, so " test@x.com" wouldn't match a stored
    // "test@x.com" and a duplicate could slip past this check.
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    // 🔥 FIX: this used to only check email. Agent.phone had no
    // uniqueness check at all (now fixed at the schema level too), so the
    // same real phone number could be used across multiple agent
    // applications with nothing to stop it.
    const existingAgent = await Agent.findOne({
      $or: [{ email: trimmedEmail }, { phone: trimmedPhone }],
    }).lean();

    if (existingAgent) {
      await cleanupCloudinaryFiles(uploadedFiles);

      const conflictField =
        existingAgent.email === trimmedEmail ? "email" : "phone";

      return res.status(409).json({
        success: false,
        message:
          conflictField === "email"
            ? "Email already registered"
            : "Phone number already registered",
      });
    }

    // 🔥 FIX: cross-role check. Nothing previously stopped the same phone
    // number from registering as BOTH an agent and a delivery partner —
    // a real risk in this business, since an agent could otherwise also
    // register as the delivery partner assigned to their own orders and
    // mark deliveries "complete" without ever actually delivering them.
    // (MongoDB can't enforce this across two different collections with a
    // single index, so this is a best-effort check — there's a small race
    // window if both registrations happen at the exact same instant.)
    const existingDeliveryPartner = await DeliveryPartner.findOne({
      phone: trimmedPhone,
    }).lean();

    if (existingDeliveryPartner) {
      await cleanupCloudinaryFiles(uploadedFiles);

      return res.status(409).json({
        success: false,
        message:
          "This phone number is already registered as a delivery partner.",
      });
    }

    /* =============================
       BASE AGENT DATA
    ============================= */
    const agentData = {
      name: name.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,

      address: address.trim(),

      addressDetails: {
        state: state.trim().toUpperCase(),
        city: city.trim(),
        street: street.trim(),
        pincode: pincode.trim(),
      },

      documents: {
        aadhaar: aadhaarPath,
        pan: panPath,
        photo: photoPath,
      },

      status: "PENDING",
      role: "AGENT",
    };

    if (hasAllBankFields) {
      agentData.bankDetails = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName.trim(),
      };
    }

    /* =============================
       SAFE AGENT ID GENERATION
    ============================= */
    const currentYear = new Date().getFullYear();

    let agent;
    let retries = 5;

    while (retries > 0) {
      try {
        const counter = await Counter.findByIdAndUpdate(
          `agent-${currentYear}`,
          { $inc: { seq: 1 } },
          { new: true, upsert: true },
        );

        const customAgentId = `BS${currentYear}-${String(counter.seq).padStart(3, "0")}`;

        agentData.agentId = customAgentId;

        agent = await Agent.create(agentData);

        // success → break loop
        break;
      } catch (error) {
        // 🔁 Retry only for agentId conflict
        if (error.code === 11000 && error.keyPattern?.agentId) {
          console.warn("Duplicate agentId, retrying...");
          retries--;
          continue;
        }

        throw error;
      }
    }

    if (!agent) {
      await cleanupCloudinaryFiles(uploadedFiles);

      return res.status(500).json({
        success: false,
        message: "Failed to generate unique agent ID",
      });
    }

    /* =============================
       NOTIFICATION
    ============================= */
    sendAdminNotification({
      customAgentId: agent.agentId,
      name,
      email,
      phone,
    }).catch((err) => {
      console.error("Email failed:", err);
    });

    /* =============================
       SUCCESS RESPONSE
    ============================= */
    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      agentId: agent.agentId,
    });
  } catch (error) {
    console.error("APPLY AGENT ERROR:", error);

    await cleanupCloudinaryFiles(uploadedFiles);

    /* =============================
       DUPLICATE ERROR HANDLING
    ============================= */
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];

      return res.status(409).json({
        success: false,
        message:
          field === "email"
            ? "Email already registered"
            : field === "phone"
              ? "Phone number already registered"
              : field === "agentId"
                ? "Agent ID conflict, auto-retrying failed"
                : `${field} already exists`,
      });
    }

    /* =============================
       GENERIC ERROR
    ============================= */
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

// GET LOGGED-IN AGENT PROFILE
export const getAgentProfile = async (req, res) => {
  try {
    const agentMongoId = req.user.id;

    const agent = await Agent.findById(agentMongoId).select(
      "-password -passwordResetToken -passwordResetExpires",
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    const data = agent.toObject();

    // ✅ Handle missing bank details
    if (!data.bankDetails || Object.keys(data.bankDetails).length === 0) {
      data.bankDetails = null;
    }

    // ✅ Add helper flag (very useful for frontend)
    data.hasBankDetails = !!data.bankDetails?.accountNumber;

    res.json({
      success: true,
      agent: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent profile",
    });
  }
};

// ASSIGN SALES LOCATION
export const assignSalesLocation = async (req, res) => {
  try {
    const { agentId, pincodes, state, city } = req.body;

    if (!agentId || !pincodes || pincodes.length === 0 || !state) {
      return res.status(400).json({
        success: false,
        message: "agentId, state and at least one pincode are required",
      });
    }

    // ✅ Check Agent exists
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // ✅ Validate pincodes
    const invalidPins = pincodes.filter((pin) => !/^[0-9]{6}$/.test(pin));

    if (invalidPins.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid pincodes: ${invalidPins.join(", ")}`,
      });
    }

    // ✅ Upsert (update or create)
    const location = await AgentSalesLocation.findOneAndUpdate(
      { agentId, state: state.toUpperCase() },
      {
        agentId,
        pincodes,
        state: state.toUpperCase(),
        city,
        assignedBy: req.user._id,
        assignedByModel: req.user.role === "ADMIN" ? "Admin" : "Employee",
      },
      { new: true, upsert: true },
    );

    return res.status(200).json({
      success: true,
      message: "Sales location assigned successfully",
      data: location,
    });
  } catch (error) {
    console.error("ASSIGN LOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Agent Dashboard

export const agentDashboard = async (req, res) => {
  const agentId = req.user.agentId; // ✅ FROM TOKEN
  try {
    const { from, to } = req.query;

    // ✅ DEFAULT (1 MONTH before the end date). This used today's date with
    // the end date's month, which was wrong whenever "to" was given, and on
    // the 29th–31st rolled forward (30 March − 1 month = 2 March).
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : oneMonthBefore(endDate);

    const data = await getAgentDashboard({
      agentId,
      from: startDate,
      to: endDate,
    });

    // console.log("FROM:", startDate);
    // console.log("TO:", endDate);
    // console.log("AGENT:", agentId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Dashboard error",
    });
  }
};

// Agent Leaderboard

export const leaderboard = async (req, res) => {
  try {
    const { from, to, limit } = req.query;

    // ✅ Default: the 30 days before the end date (this used today's month
    // with the end date's day, so a given "to" gave a wrong or empty range)
    const endDate = to ? new Date(to) : new Date();
    const startDate = from
      ? new Date(from)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const data = await getLeaderboard({
      from: startDate,
      to: endDate,
      // Query strings arrive as text; the database rejects a text limit
      limit: Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100),
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Leaderboard error",
    });
  }
};

/**
 * LIST ASSIGNED SALES LOCATIONS (Admin / Employee with canAssignLocations)
 *
 * Added because assignSalesLocation upserts on (agentId, state): saving
 * replaces that agent's whole pincode list for the state. Without a way to
 * read the current assignment first, the admin panel was overwriting
 * coverage blind.
 *
 * Optional ?agentId= narrows it to one agent.
 */
export const getSalesLocations = async (req, res) => {
  try {
    const { agentId } = req.query;

    const filter = agentId ? { agentId: String(agentId).trim() } : {};

    const locations = await AgentSalesLocation.find(filter).sort({
      agentId: 1,
      state: 1,
    });

    return res.json({
      success: true,
      count: locations.length,
      locations,
    });
  } catch (error) {
    console.error("GET SALES LOCATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales locations",
    });
  }
};
