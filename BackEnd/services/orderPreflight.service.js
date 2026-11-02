import mongoose from "mongoose";
import Product from "../models/Product.js";
import { findManagedStore } from "./storeAccess.service.js";
import { effectiveMinimum } from "../utils/orderMinimums.js";
import { effectivePrice, getLocationOverrides } from "../utils/pricing.js";
const refuse = (message, status = 400) => { throw Object.assign(new Error(message), { status, preflight: true }); };
// Additive: old clients send only amount. New mobile clients also send the cart
// so invalid minimums/prices/ownership are refused before creating a payment UI.
export const preflightInitialPayment = async ({ agentId, payload, amount }) => {
  if (payload === undefined) return;
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.consumerId !== "string" || payload.consumerId.length > 100 || !Array.isArray(payload.products) || !payload.products.length || payload.products.length > 200) refuse("Refresh the cart before starting payment");
  const store = await findManagedStore(payload.consumerId, agentId).lean();
  if (!store) refuse("Store not found or no longer assigned to you", 403);
  const lines = new Map();
  for (const item of payload.products) {
    if (!item || !mongoose.isValidObjectId(item.productId) || !["number", "string"].includes(typeof item.quantity) || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.unitPrice))) refuse("Refresh the cart before starting payment");
    const productId = new mongoose.Types.ObjectId(item.productId).toString();
    const previous = lines.get(productId);
    if (previous && previous.price !== Number(item.unitPrice)) refuse("The same product has different prices. Refresh the cart.");
    lines.set(productId, { quantity: (previous?.quantity || 0) + Number(item.quantity), price: Number(item.unitPrice) });
  }
  const [products, overrides] = await Promise.all([Product.find({ _id: { $in: [...lines.keys()] }, status: "ACTIVE" }).lean(), getLocationOverrides(agentId, store.address?.state)]);
  if (products.length !== lines.size) refuse("A product is no longer available. Refresh the cart.");
  let total = 0;
  for (const product of products) {
    const line = lines.get(String(product._id)), minimum = effectiveMinimum(product, store.storeType);
    if (line.quantity < minimum) refuse(`${product.name}: minimum order is ${minimum} ${product.uom} for this store category.`);
    if (!Number.isFinite(product.stock) || line.quantity > product.stock) refuse(product.stock <= 0 ? `${product.name} is out of stock. Remove it from the cart or wait for restocking.` : `Not enough stock for ${product.name}. Refresh the cart.`);
    const { price } = effectivePrice(product, store.storeType, overrides.get(String(product._id)));
    if (price === null || Math.abs(price - line.price) > 0.005) refuse("Product prices changed. Refresh the cart before paying.", 409);
    total = Math.round((total + Math.round(price * line.quantity * 100) / 100) * 100) / 100;
  }
  if (amount > total + 0.005) refuse("The payment exceeds the current order total. Refresh the cart.");
};
