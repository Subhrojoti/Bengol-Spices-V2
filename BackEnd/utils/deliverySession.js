import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

export const signDeliverySession = (partner) => jwt.sign({
  id: partner._id,
  role: partner.role,
  name: partner.name,
  sessionVersion: partner.sessionVersion || 0,
}, process.env.JWT_SECRET, { expiresIn: "30d", jwtid: randomUUID() });
