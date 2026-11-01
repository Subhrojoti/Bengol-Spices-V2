import mongoose from "mongoose";
import Store from "../models/store.js";
import StoreChangeRequest from "../models/StoreChangeRequest.js";
import { findManagedStore, managerOf } from "../services/storeAccess.service.js";
import { actorOf } from "../services/deliveryTrail.service.js";
import { readGstNumber, registrationGps } from "../utils/storeDetails.js";
import { normalizeSalesState, normalizePincode, coverageForState } from "../utils/salesLocation.js";
import AgentSalesLocation from "../models/AgentSalesLocation.js";
import cloudinary from "../config/cloudinary.js";
import { withStoreLocks } from "../services/storeOperation.service.js";
import { withStorePhoneLock } from "../services/storePhone.service.js";

const fields = ["storeName", "ownerName", "phone", "address", "gstNumber", "image", "location"];
const snapshot = store => Object.fromEntries(fields.map(key => [key, store[key]]));
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handle = work => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) {
    if (req.file?.filename && !req.proposalOwnsPhoto) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    if (!error.status && error.code !== 11000) console.error("STORE CHANGE ERROR:", error.message);
    res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ success: false, message: error.status ? error.message : error.code === 11000 ? "A request for this store already exists. Refresh its history." : "Could not process the store request. Refresh before retrying." });
  }
};
const submit = async (req, res) => {
  if (Object.keys(req.body).some(key => !["changes", "clientRequestId"].includes(key))) fail("Only a change request and request identifier may be submitted");
  const store = await findManagedStore(req.params.consumerId, req.user.agentId).lean();
  if (!store) fail("Store not found or no longer managed by you", 404);
  const requestId = req.body.clientRequestId;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) fail("A valid request identifier is required");
  const previous = await StoreChangeRequest.findOne({ agentId: req.user.agentId, clientRequestId: requestId }).lean();
  if (previous) {
    if (previous.consumerId !== store.consumerId) fail("Request identifier belongs to another store", 409);
    if (req.file?.filename) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    req.proposalOwnsPhoto = true;
    return res.json({ success: true, request: previous, replayed: true });
  }
  if (await StoreChangeRequest.exists({ consumerId: store.consumerId, status: "PENDING" })) fail("This store already has a pending change request", 409);
  let proposed;
  try { proposed = typeof req.body.changes === "string" ? JSON.parse(req.body.changes) : req.body.changes; } catch { fail("Invalid store changes"); }
  if (!proposed || typeof proposed !== "object" || Array.isArray(proposed) || Object.keys(proposed).some(key => !fields.includes(key) || key === "image")) fail("Only store name, owner, phone, address, GST, photo and GPS changes are allowed");
  const changes = {};
  for (const key of ["storeName", "ownerName", "phone"]) if (proposed[key] !== undefined) {
    if (typeof proposed[key] !== "string" || !proposed[key].trim() || proposed[key].length > (key === "phone" ? 10 : 120)) fail(`Enter a valid ${key}`);
    changes[key] = proposed[key].trim();
  }
  if (changes.phone && !/^\d{10}$/.test(changes.phone)) fail("Enter a valid 10-digit phone number");
  if (proposed.gstNumber !== undefined) { try { changes.gstNumber = readGstNumber(proposed.gstNumber); } catch (e) { fail(e.message); } }
  if (proposed.address !== undefined) {
    const address = proposed.address;
    if (!address || typeof address !== "object" || Array.isArray(address) || Object.keys(address).some(key => !["state", "city", "street", "pincode"].includes(key))) fail("Enter a complete valid address");
    for (const key of ["state", "city", "street", "pincode"]) if (typeof address[key] !== "string" || !address[key].trim() || address[key].length > 300) fail("Enter a complete valid address");
    changes.address = { state: normalizeSalesState(address.state), city: address.city.trim(), street: address.street.trim(), pincode: normalizePincode(address.pincode) };
    if (!/^\d{6}$/.test(changes.address.pincode)) fail("Enter a valid 6-digit pincode");
  }
  if (proposed.location !== undefined) {
    const location = proposed.location;
    if (!location || typeof location !== "object" || typeof location.latitude !== "number" || typeof location.longitude !== "number" || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || location.latitude < 6 || location.latitude > 38 || location.longitude < 68 || location.longitude > 98) fail("Capture a valid store GPS location");
    let metadata;
    try { metadata = registrationGps({ registrationVersion: 2, locationAccuracy: location.accuracy, locationCapturedAt: location.capturedAt, photoTakenAt: location.photoTakenAt, locationMocked: location.mocked }); } catch (e) { fail(e.message); }
    changes.location = { latitude: location.latitude, longitude: location.longitude, ...metadata };
  }
  if (req.file) changes.image = { url: req.file.path, publicId: req.file.filename };
  if (!Object.keys(changes).length) fail("Choose at least one change");
  const request = await StoreChangeRequest.create({ consumerId: store.consumerId, agentId: req.user.agentId, clientRequestId: requestId,
    detailsVersion: store.detailsVersion || 0, ownershipVersion: store.ownershipVersion || 0, before: snapshot(store), proposed: changes });
  req.proposalOwnsPhoto = true;
  res.status(201).json({ success: true, request });
};
export const submitStoreChanges = handle((req, res) => withStoreLocks([req.params.consumerId], () => submit(req, res)));

export const listStoreChanges = handle(async (req, res) => {
  const filter = {};
  if (req.user.role === "AGENT") {
    if (!await findManagedStore(req.params.consumerId, req.user.agentId).select("_id")) fail("Store not found", 404);
    filter.consumerId = req.params.consumerId;
  } else {
    const status = req.query.status || "PENDING";
    if (typeof status !== "string" || !["PENDING", "APPROVED", "REJECTED", "ALL"].includes(status)) fail("Invalid request status");
    if (status !== "ALL") filter.status = status;
  }
  const rawPage = req.query.page || "1";
  if (typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 1000000) fail("Invalid page");
  const total = await StoreChangeRequest.countDocuments(filter), pages = Math.max(1, Math.ceil(total / 25)), page = Math.min(Number(rawPage), pages);
  const requests = await StoreChangeRequest.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).lean();
  res.json({ success: true, requests, total, pages, page });
});

export const reviewStoreChanges = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId) || !["APPROVED", "REJECTED"].includes(req.body.decision) || typeof req.body.reason !== "string" || !req.body.reason.trim() || req.body.reason.length > 500) fail("Choose approve or reject and provide a review reason");
  const actor = await actorOf(req.user);
  const runReview = () => mongoose.connection.transaction(async session => {
    const request = await StoreChangeRequest.findOne({ _id: req.params.requestId }).session(session);
    if (!request) fail("Request not found", 404);
    if (request.status !== "PENDING") fail("This request was already reviewed. Refresh its history.", 409);
    if (req.body.decision === "APPROVED") {
      const store = await Store.findOne({ consumerId: request.consumerId, status: "ACTIVE" }).session(session);
      if (!store || managerOf(store) !== request.agentId || (store.ownershipVersion || 0) !== request.ownershipVersion || (store.detailsVersion || 0) !== request.detailsVersion) fail("Store details or ownership changed. Reject this stale request and ask for a fresh one.", 409);
      if (request.proposed.phone && await Store.exists({ consumerId: { $ne: store.consumerId }, phone: request.proposed.phone }).session(session)) fail("Another store already uses this phone number", 409);
      if (request.proposed.address) {
        const coverage = coverageForState(await AgentSalesLocation.find({ agentId: request.agentId }).session(session).lean(), request.proposed.address.state);
        if (!coverage.some(row => row.pincodes?.includes(request.proposed.address.pincode))) fail("The requested address is outside the agent's assigned coverage", 409);
      }
      for (const key of fields) if (request.proposed[key] !== undefined) store[key] = request.proposed[key];
      store.detailsVersion = (store.detailsVersion || 0) + 1;
      await store.save({ session });
    }
    request.status = req.body.decision; request.reason = req.body.reason.trim(); request.reviewedAt = new Date(); request.reviewedBy = actor;
    await request.save({ session });
    return request;
  });
  const proposal = req.body.decision === "APPROVED" ? await StoreChangeRequest.findById(req.params.requestId).select("proposed.phone").lean() : null;
  const request = proposal?.proposed?.phone ? await withStorePhoneLock(proposal.proposed.phone, runReview) : await runReview();
  res.json({ success: true, request });
});
