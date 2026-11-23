import { createHash } from "node:crypto";

export const sessionDigest = (token) =>
  createHash("sha256").update(token.slice(0, token.lastIndexOf("."))).digest("hex");

export const revokedSessionField = {
  type: [{ _id: false, digest: String, expiresAt: Date }],
  default: undefined,
  select: false,
};

export function revokeSession(Model, user, token, fields = {}) {
  const now = new Date();
  const expiresAt = Number.isFinite(user.exp) ? new Date(user.exp * 1000) : new Date(8640000000000000);
  return Model.updateOne({ _id: user.id }, [{ $set: {
    ...fields,
    revokedSessions: { $setUnion: [
      { $filter: { input: { $ifNull: ["$revokedSessions", []] }, cond: { $gt: ["$$this.expiresAt", now] } } },
      [{ digest: sessionDigest(token), expiresAt }],
    ] },
  } }], { updatePipeline: true });
}
