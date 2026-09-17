import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import DeliveryPartner from "../models/DeliveryPartner.js";
import cloudinary from "../config/cloudinary.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";
import Agent from "../models/Agent.js";
import mongoose from "mongoose";
/* REGISTER */
export const registerDeliveryPartner = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const {
      name,
      phone,
      email,
      password,
      idType,
      idNumber,
      state,
      city,
      street,
      pincode,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
    } = req.body;

    if (!req.file) throw new Error("Document is required");
    uploadedPublicId = req.file.filename;

    if (
      !name ||
      !phone ||
      !password ||
      !idType ||
      !idNumber ||
      !state ||
      !city ||
      !street ||
      !pincode
    ) {
      throw new Error("All fields are required");
    }

    // 🔥 FIX: trim before the uniqueness check. The schema trims phone on
    // save, but findOne() doesn't apply schema trimming to the query — so
    // " 9831431018" (with a stray space) would not match an existing
    // "9831431018", letting a duplicate slip past this check and fail
    // later with a raw MongoDB duplicate-key error instead (see the catch
    // block fix below).
    const trimmedPhone = phone.trim();

    const exists = await DeliveryPartner.findOne({ phone: trimmedPhone });
    if (exists) throw new Error("Already registered");

    // 🔥 FIX: cross-role check, mirroring the equivalent one added to
    // applyAgent. Nothing previously stopped the same phone number from
    // registering as BOTH an agent and a delivery partner — a real risk
    // here, since an agent could otherwise also register as the delivery
    // partner assigned to their own orders and mark deliveries "complete"
    // without ever actually delivering them.
    const existingAgent = await Agent.findOne({ phone: trimmedPhone });
    if (existingAgent) {
      throw new Error("This phone number is already registered as an agent.");
    }

    // 🔥 FIX: bank details must be all-or-nothing, matching applyAgent's
    // validation. Previously, submitting only SOME bank fields (e.g. just
    // accountNumber) silently dropped all of them with no error — the
    // registration would succeed as if bank details were never provided,
    // with no indication anything was wrong.
    const hasAnyBankField =
      accountHolderName || accountNumber || ifscCode || bankName;
    const hasAllBankFields =
      accountHolderName && accountNumber && ifscCode && bankName;

    if (hasAnyBankField && !hasAllBankFields) {
      throw new Error("Please provide complete bank details");
    }

    // Anything was accepted, even "1"; same rule as resetting a password
    if (
      typeof password !== "string" ||
      !/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)
    ) {
      throw new Error(
        "Password must be at least 6 characters long and contain letters and numbers",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const partnerData = {
      name,
      phone: trimmedPhone,
      // Password reset emails go to this address; keep it in one form
      email: typeof email === "string" ? email.trim().toLowerCase() : email,
      password: hashedPassword,
      status: "PENDING", // 🔥 IMPORTANT
      address: { state, city, street, pincode },
      documents: {
        idType,
        idNumber,
        documentUrl: req.file.path,
      },
    };

    if (hasAllBankFields) {
      partnerData.bankDetails = {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
      };
    }

    await DeliveryPartner.create(partnerData);

    res.status(201).json({
      success: true,
      message: "Application submitted. Await admin approval.",
    });
  } catch (error) {
    if (uploadedPublicId) {
      await cloudinary.uploader.destroy(uploadedPublicId);
    }

    // 🔥 FIX: gracefully handle duplicate-key errors instead of leaking a
    // raw MongoDB error message (e.g. "E11000 duplicate key error
    // collection: ...") straight to the client.
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      return res.status(409).json({
        success: false,
        message:
          field === "phone"
            ? "Phone number already registered"
            : `${field} already exists`,
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELIVERY PARTNER LOGIN (STRICT STATUS VALIDATION)
export const loginDeliveryPartner = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // 🔥 FIX: without this check, a request missing "phone" entirely would
    // query findOne({ phone: undefined }) — Mongoose drops undefined keys
    // from the query, so this can silently become findOne({}) and match
    // an arbitrary delivery partner document instead of correctly
    // rejecting the request. (Same issue agentLogin already guards
    // against — this endpoint was missing the equivalent check.)
    if (
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !phone.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required",
      });
    }

    const partner = await DeliveryPartner.findOne({ phone: phone.trim() });

    // ❌ Not found
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Phone No. or Password does not match",
      });
    }

    // 🔒 STRICT STATUS CHECK (MOST IMPORTANT FIX)
    if (partner.status !== "ACTIVE") {
      let message = "Your account is not active";

      if (partner.status === "PENDING") {
        message =
          "Your account is under review. Please wait for admin approval.";
      } else if (partner.status === "REJECTED") {
        message =
          "Your application has been rejected. Please contact support or reapply.";
      } else if (partner.status === "INACTIVE") {
        message = "Your account is inactive. Contact support.";
      } else {
        // ❗ Handles corrupted values like "SA"
        message = "Invalid account status. Please contact support.";
      }

      return res.status(403).json({
        success: false,
        message,
      });
    }

    // 🔐 PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, partner.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Phone No. or Password does not match",
      });
    }

    // ✅ UPDATE ONLINE STATUS
    await DeliveryPartner.updateOne(
      { _id: partner._id },
      { $set: { isOnline: true } },
    );

    // 🔑 TOKEN
    const token = jwt.sign(
      {
        id: partner._id,
        role: partner.role,
        name: partner.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("LOGIN DELIVERY PARTNER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};
/* LOGOUT */
export const logoutDeliveryPartner = async (req, res) => {
  // 🔥 FIX: this had no try/catch at all — unlike every other handler in
  // this file, any DB error here would crash the request instead of
  // returning a clean JSON response. Also now returns 404 if the partner
  // record is somehow missing, matching employeeLogout's pattern.
  try {
    const partner = await DeliveryPartner.findById(req.user.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    partner.isOnline = false;
    await partner.save();

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("DELIVERY PARTNER LOGOUT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

/* GET ALL ACTIVE DELIVERY PARTNERS (ADMIN) */
export const getAllDeliveryPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find()
      .select("-password -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: partners.length,
      data: partners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch delivery partners",
    });
  }
};

/* Get My assigned orders (DELIVERY PARTNER) */
export const getMyAssignedOrders = async (req, res) => {
  try {
    const partnerId = req.user.id;

    const orders = await Order.find({
      "delivery.partnerId": partnerId,
      status: {
        $in: ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"],
      },
    })
      // Without deliveryCode: the store owner reads it out at handover, and
      // showing it here let a partner confirm without visiting the store
      .populate("store", "storeName address location")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assigned orders",
    });
  }
};

/* Get Delivery partner Dashboard Stats */
export const getDeliveryPartnerDashboard = async (req, res) => {
  try {
    const partnerId = req.user.id;
    const partnerObjectId = new mongoose.Types.ObjectId(partnerId);
    const currentYear = new Date().getFullYear();

    /* ============================
       SUMMARY COUNTS
    ============================ */

    const totalDelivered = await Order.countDocuments({
      "delivery.partnerId": partnerId,
      status: "DELIVERED",
    });

    // A completed return whose refund is then processed is still one this
    // partner handled; it used to drop out of the count at that point
    const totalReturnsHandled = await Return.countDocuments({
      "pickup.partnerId": partnerId,
      status: { $in: ["COMPLETED", "REFUND_PROCESSED"] },
    });

    const activeDeliveries = await Order.countDocuments({
      "delivery.partnerId": partnerId,
      status: { $in: ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"] },
    });

    const totalPendingPickups = await Return.countDocuments({
      "pickup.partnerId": partnerId,
      status: {
        $in: ["PICKUP_ASSIGNED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE"],
      },
    });

    /* ============================
       MONTHLY DELIVERY DISTRIBUTION
       (Current Year)
    ============================ */

    /* Dated by when the order was actually delivered (its DELIVERED status
       entry). updatedAt moves whenever the order is saved again, so a due
       payment collected weeks later shifted the delivery into that month. */
    const yearStart = new Date(`${currentYear}-01-01`);

    const monthlyDelivered = await Order.aggregate([
      {
        $match: {
          "delivery.partnerId": partnerObjectId,
          status: "DELIVERED",
        },
      },
      { $unwind: "$statusHistory" },
      {
        $match: {
          "statusHistory.status": "DELIVERED",
          "statusHistory.changedAt": { $gte: yearStart },
        },
      },
      {
        $group: {
          _id: { $month: "$statusHistory.changedAt" },
          delivered: { $sum: 1 },
        },
      },
    ]);

    const monthlyReturns = await Return.aggregate([
      {
        $match: {
          "pickup.partnerId": partnerObjectId,
          status: { $in: ["COMPLETED", "REFUND_PROCESSED"] },
        },
      },
      { $unwind: "$statusHistory" },
      {
        $match: {
          "statusHistory.status": "COMPLETED",
          "statusHistory.changedAt": { $gte: yearStart },
        },
      },
      {
        $group: {
          _id: { $month: "$statusHistory.changedAt" },
          returns: { $sum: 1 },
        },
      },
    ]);

    // Format months 1–12
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyDistribution = months.map((month, index) => {
      const deliveredData = monthlyDelivered.find((d) => d._id === index + 1);

      const returnData = monthlyReturns.find((r) => r._id === index + 1);

      return {
        month,
        delivered: deliveredData ? deliveredData.delivered : 0,
        returns: returnData ? returnData.returns : 0,
      };
    });

    /* ============================
       YEARLY COMPARISON (LAST 3 YEARS)
    ============================ */

    // Also by delivery date, for the same reason as the monthly figures
    const deliveredByYear = await Order.aggregate([
      {
        $match: {
          "delivery.partnerId": partnerObjectId,
          status: "DELIVERED",
        },
      },
      { $unwind: "$statusHistory" },
      { $match: { "statusHistory.status": "DELIVERED" } },
      {
        $group: {
          _id: { $year: "$statusHistory.changedAt" },
          delivered: { $sum: 1 },
        },
      },
    ]);

    const yearlyComparison = [0, 1, 2].map((i) => {
      const year = currentYear - i;
      return {
        year,
        delivered: deliveredByYear.find((y) => y._id === year)?.delivered || 0,
      };
    });

    return res.json({
      success: true,
      data: {
        summary: {
          totalDelivered,
          totalReturnsHandled,
          totalPendingPickups,
          activeDeliveries,
        },
        monthlyDeliveryDistribution: monthlyDistribution,
        yearlyComparison,
        meta: {
          generatedAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("DELIVERY DASHBOARD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

/* Get Partner Profile */
export const getProfile = async (req, res) => {
  try {
    const partnerId = req.user.id;

    const partner = await DeliveryPartner.findById(partnerId).select(
      "-password -passwordResetToken -passwordResetExpires",
    );

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    // Convert to plain object
    const data = partner.toObject();

    // 👉 If bankDetails doesn't exist, remove it OR set null
    if (!data.bankDetails || Object.keys(data.bankDetails).length === 0) {
      data.bankDetails = null; // OR delete data.bankDetails;
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* Shared helper — delivered orders + completed returns for one partner */
async function fetchPartnerHistory(partnerId) {
  const [deliveredOrders, completedReturns] = await Promise.all([
    Order.find({
      "delivery.partnerId": partnerId,
      status: "DELIVERED",
    })
      .populate("store", "storeName address location")
      .sort({ updatedAt: -1 }),

    Return.find({
      "pickup.partnerId": partnerId,
      status: { $in: ["COMPLETED", "REFUND_PROCESSED"] },
    }).sort({ updatedAt: -1 }),
  ]);

  return { deliveredOrders, completedReturns };
}

/* GET MY DELIVERY & RETURN HISTORY (DELIVERY PARTNER) */
export const getMyDeliveryHistory = async (req, res) => {
  try {
    const data = await fetchPartnerHistory(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("GET DELIVERY HISTORY ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch delivery history" });
  }
};

/* GET A SPECIFIC DELIVERY PARTNER'S HISTORY (ADMIN / EMPLOYEE) */
export const getDeliveryPartnerHistory = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner =
      await DeliveryPartner.findById(partnerId).select("name phone status");
    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Delivery partner not found" });
    }

    const data = await fetchPartnerHistory(partnerId);
    return res.status(200).json({ success: true, partner, data });
  } catch (error) {
    console.error("GET DELIVERY PARTNER HISTORY ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery partner history",
    });
  }
};

/* CHANGE PASSWORD (DELIVERY PARTNER)
   There was only the forgot-password email flow; a partner who knew their
   password had no way to change it. Other devices signed in with the old
   password are signed out, and this device gets a fresh login token. */
export const changeDeliveryPartnerPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string" ||
      !oldPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required",
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters long and contain letters and numbers",
      });
    }

    const partner = await DeliveryPartner.findById(req.user.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    // 400, not 401: the panel signs the user out on any 401
    if (!(await bcrypt.compare(oldPassword, partner.password))) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    if (await bcrypt.compare(newPassword, partner.password)) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as the current one",
      });
    }

    /* Only these two fields are written, so an older record missing some
       other required detail cannot block a password change.
       Tokens issued before passwordChangedAt stop working. It is set a
       moment early so the token issued just below (whose "issued at" is in
       whole seconds) is not caught by it. */
    await DeliveryPartner.updateOne(
      { _id: partner._id },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 10),
          passwordChangedAt: new Date(Date.now() - 2000),
        },
      },
    );

    const token = jwt.sign(
      { id: partner._id, role: partner.role, name: partner.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
      token,
    });
  } catch (error) {
    console.error("DELIVERY PARTNER CHANGE PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};
