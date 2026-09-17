import jwt from "jsonwebtoken";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";
import DeliveryPartner from "../models/DeliveryPartner.js";

/* A token only proves who someone WAS when they logged in. For every role
   with an account record, the record is checked on each request, so:
     - a deactivated, rejected or deleted account stops working at once
       instead of up to 30 days later when its token expires,
     - resetting a password signs out every device that knew the old one,
     - an employee's permissions are read fresh, so a permission the admin
       removes is gone immediately rather than at the employee's next login.
   Admin has no account record (credentials live in the server config), so
   an admin token is checked by signature and expiry alone, as before. */
const ACCOUNTS = {
  AGENT: {
    model: Agent,
    activeStatus: "APPROVED",
    fields: "status passwordChangedAt",
  },
  EMPLOYEE: {
    model: Employee,
    activeStatus: "ACTIVE",
    fields: "status passwordChangedAt permissions name",
  },
  DELIVERY_PARTNER: {
    model: DeliveryPartner,
    activeStatus: "ACTIVE",
    fields: "status passwordChangedAt",
  },
};

const unauthorized = (res, message) =>
  res.status(401).json({ success: false, message });

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "No token provided");
  }

  const token = authHeader.slice(7).trim();

  let decoded;
  try {
    // Every token this server issues is HS256; refuse any other algorithm
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    return unauthorized(
      res,
      error.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid token",
    );
  }

  req.user = {
    _id: decoded.id, // 🔥 FIX
    role: decoded.role,
    ...decoded,
  };

  const account = ACCOUNTS[decoded.role];
  if (!account) return next();

  try {
    const record = decoded.id
      ? await account.model.findById(decoded.id).select(account.fields).lean()
      : null;

    if (!record) {
      return unauthorized(res, "Account not found. Please log in again.");
    }

    if (record.status !== account.activeStatus) {
      return unauthorized(res, "Your account is no longer active.");
    }

    // A second of slack for a login made in the same instant as the reset
    if (
      record.passwordChangedAt &&
      decoded.iat * 1000 + 1000 < new Date(record.passwordChangedAt).getTime()
    ) {
      return unauthorized(
        res,
        "Your password was changed. Please log in again.",
      );
    }

    if (decoded.role === "EMPLOYEE") {
      req.user.permissions = record.permissions || {};
      req.user.name = record.name;
    }

    next();
  } catch (error) {
    console.error("AUTH CHECK ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Could not verify your session. Please try again.",
    });
  }
};
