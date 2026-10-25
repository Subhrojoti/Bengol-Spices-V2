import cloudinary from "../config/cloudinary.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import Employee from "../models/Employee.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { withLock } from "./payment.service.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ownedFolder = /^(bengol_spices\/(agents|others|invoices|stores)\/)/;

// Only files in our configured Cloudinary account and application folders.
// Never fetch an arbitrary URL or infer deletion credentials from a browser request.
export const mediaAssetOf = (url) => {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return null;
    const match = parsed.pathname.match(/^\/([^/]+)\/(image|raw|video)\/upload\/(.+)$/);
    if (!match || match[1] !== cloudinary.config().cloud_name) return null;
    let publicId = decodeURIComponent(match[3]);
    if (!publicId.startsWith("bengol_spices/")) publicId = publicId.replace(/^(?:[^/]+\/)*?v\d+\//, "");
    if (match[2] !== "raw") publicId = publicId.replace(/\.[^/.]+$/, "");
    if (!ownedFolder.test(publicId) || publicId.split("/").some((part) => !part || part === "." || part === "..") || /[\\\x00-\x1f]/.test(publicId)) return null;
    return { publicId, cloudName: match[1], resourceType: match[2], assetKey: `${match[2]}:${publicId}` };
  } catch { return null; }
};

const mediaReferences = [
  [Agent, ["documents.aadhaar", "documents.pan", "documents.photo", "applicationHistory.documents.aadhaar", "applicationHistory.documents.pan", "applicationHistory.documents.photo"]],
  [Store, ["image.url"]], [Invoice, ["pdfUrl"]],
  [Product, ["images.front.url", "images.back.url"]],
  [Employee, ["profilePic.url"]], [DeliveryPartner, ["documents.documentUrl"]],
];

export const assetIsReferenced = async (asset, exclusions = new Map(), session = null) => {
  // Version/format changes still refer to the same underlying Cloudinary public ID.
  const suffix = asset.resourceType === "raw" ? "(?:[?#]|$)" : "(?:\\.[^/?#]+)?(?:[?#]|$)";
  const variants = [...new Set([asset.publicId, encodeURI(asset.publicId), asset.publicId.split("/").map(encodeURIComponent).join("/")])];
  const expression = new RegExp(`/` + `(?:${variants.map(escapeRegex).join("|")})` + suffix);
  for (const [model, fields] of mediaReferences) {
    const query = model.exists({ _id: { $nin: exclusions.get(model.modelName) || [] }, $or: fields.map((field) => ({ [field]: expression })) });
    if (session) query.session(session);
    if (await query) return true;
  }
  return false;
};

export const getMediaCleanup = async (batchId) => {
  const jobs = await MediaDeletionJob.find({ batchId }).select("status lastError publicId attempts").lean();
  const count = (status) => jobs.filter((j) => j.status === status).length;
  return { batchId, total: jobs.length, deleted: count("DELETED"), pending: count("PENDING"), failed: count("FAILED"), shared: count("SHARED"), failures: jobs.filter((j) => j.status === "FAILED").map(({ publicId, lastError }) => ({ publicId, message: lastError })) };
};

// Database deletion commits before external deletion. Failed jobs remain durable
// and admin-retryable; a Cloudinary failure never pretends the DB rolled back.
export const processMediaCleanup = async (batchId) => {
  const locked = await withLock(`media-cleanup:${batchId}`, async () => {
    const jobs = await MediaDeletionJob.find({ batchId, status: { $in: ["PENDING", "FAILED"] } }).sort({ _id: 1 }).limit(40).lean();
    for (let offset = 0; offset < jobs.length; offset += 4) {
      await Promise.all(jobs.slice(offset, offset + 4).map(async (job) => {
        try {
          if (await assetIsReferenced(job)) {
            await MediaDeletionJob.updateOne({ _id: job._id }, { $set: { status: "SHARED", lastError: "Retained because another record uses this file" } });
            return;
          }
          const config = cloudinary.config();
          if (!config.cloud_name || !config.api_key || !config.api_secret) throw new Error("Cloudinary is not configured; retry file cleanup after configuration is restored");
          if (config.cloud_name !== job.cloudName) throw new Error("Storage account changed; restore the original storage account before retrying cleanup");
          const response = await cloudinary.uploader.destroy(job.publicId, { resource_type: job.resourceType, invalidate: true, timeout: 10000 });
          if (!["ok", "not found"].includes(response?.result)) throw new Error("Cloudinary did not confirm file deletion");
          await MediaDeletionJob.updateOne({ _id: job._id }, { $set: { status: "DELETED", deletedAt: new Date() }, $unset: { lastError: "" }, $inc: { attempts: 1 } });
        } catch (error) {
          // Do not store upstream request objects, credentials or signed URLs.
          const message = error.message?.startsWith("Cloudinary is not configured") ? error.message : "File removal failed. Retry cleanup; the database deletion is already committed.";
          await MediaDeletionJob.updateOne({ _id: job._id }, { $set: { status: "FAILED", lastError: message }, $inc: { attempts: 1 } });
        }
      }));
    }
  }, { leaseMs: 10 * 60 * 1000 });
  return { ...(await getMediaCleanup(batchId)), busy: locked.busy };
};
