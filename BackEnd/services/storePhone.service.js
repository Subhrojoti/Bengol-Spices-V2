import crypto from "node:crypto";
import { withLock } from "./payment.service.js";
// Registration and approved phone changes share this lock. No unique index is
// imposed on legacy stores, which may already need data review.
export const withStorePhoneLock = async (phone, work) => {
  const digest = crypto.createHash("sha256").update(String(phone).trim()).digest("hex");
  const locked = await withLock(`store-phone:${digest}`, work);
  if (locked.busy) throw Object.assign(new Error("This phone number is being used in another store update. Please retry shortly."), { status: 409 });
  return locked.value;
};
