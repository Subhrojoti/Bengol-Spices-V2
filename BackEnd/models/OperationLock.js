import mongoose from "mongoose";

/* A short-lived lock: one document per key, and the unique index lets only
   one request create it. Used so two requests can never work on the same
   order's payments, or the same agent's payout, at the same moment.

   expiresAt lets MongoDB remove a lock left behind by a crashed request (the
   TTL monitor runs about once a minute); acquireLock also takes over a lock
   whose time has passed without waiting for that. */
const operationLockSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    // Identifies the holder, so a request whose lock was taken over after
    // it expired cannot release the new holder's lock
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

operationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OperationLock", operationLockSchema);
