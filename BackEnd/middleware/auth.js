import jwt from "jsonwebtoken";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { agentSessionMatches } from "../utils/agentAccess.js";

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
    fields: "status passwordChangedAt accessStatus sessionVersion",
  },
  EMPLOYEE: {
    model: Employee,
    activeStatus: "ACTIVE",
    fields: "status passwordChangedAt permissions name",
  },
  DELIVERY_PARTNER: {
    model: DeliveryPartner,
    activeStatus: "ACTIVE",
    fields: "status passwordChangedAt sessionVersion",
  },
};

/* For the few addresses that work signed out but show more when signed in
   (the product catalogue: anyone may see the range, only signed-in users
   see trade prices). No Authorization header: carry on as a visitor, with
   no req.user. A header that is present is checked in full, exactly as
   protect does, so an expired or revoked session is told so rather than
   silently treated as a visitor. */
export const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return protect(req, res, next);
};

const unauthorized = (res, message) =>
  res.status(401).json({ success: false, message });

// Shared with live-event delivery: long-lived connections must recheck the
// same account, expiry and permission rules as an ordinary API request.
export const authenticatedUser = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    throw Object.assign(new Error(error.name === "TokenExpiredError"
      ? "Session expired. Please log in again." : "Invalid token"), { status: 401 });
  }
  const reject = (message) => { throw Object.assign(new Error(message), { status: 401 }); };
  if (!decoded || typeof decoded !== "object" ||
      (decoded.role !== "ADMIN" && !Object.hasOwn(ACCOUNTS, decoded.role))) reject("Invalid token");
  const user = { ...decoded, _id: decoded.id };
  if (decoded.role === "ADMIN") return user;
  if (typeof decoded.id !== "string" || !/^[a-f0-9]{24}$/i.test(decoded.id)) reject("Invalid token");
  const account = ACCOUNTS[decoded.role];
  const record = await account.model.findById(decoded.id).select(account.fields).lean();
  if (!record) reject("Account not found. Please log in again.");
  if (record.status !== account.activeStatus) reject("Your account is no longer active.");
  if (decoded.role === "AGENT" && !agentSessionMatches(record, decoded)) {
    reject("Your access has changed. Please contact the office or sign in again.");
  }
  if (decoded.role === "DELIVERY_PARTNER" && (record.sessionVersion || 0) !== (decoded.sessionVersion || 0)) {
    reject("Your password was changed. Please log in again.");
  }
  if (record.passwordChangedAt && decoded.iat * 1000 + 1000 < new Date(record.passwordChangedAt).getTime()) {
    reject("Your password was changed. Please log in again.");
  }
  if (decoded.role === "EMPLOYEE") {
    user.permissions = record.permissions || {};
    user.name = record.name;
  }
  return user;
};

export const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return unauthorized(res, "No token provided");
  try {
    req.user = await authenticatedUser(header.slice(7).trim());
    return next();
  } catch (error) {
    if (error.status === 401) return unauthorized(res, error.message);
    console.error("AUTH CHECK ERROR:", error);
    return res.status(500).json({ success: false, message: "Could not verify your session. Please try again." });
  }
};
