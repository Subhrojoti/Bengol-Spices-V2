import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import { createInvoiceFromOrder } from "./invoice.service.js";
import { effectiveMinimum } from "../utils/orderMinimums.js";
import { needsVerification, pendingVerification } from "../utils/paymentVerification.js";

export const createInitialOrderRecords = ({ fields, stockLines, storeType, paymentMethod, gateway = {} }) => mongoose.connection.transaction(async session => {
  const quantities = new Map();
  for (const line of stockLines) quantities.set(String(line.productId), (quantities.get(String(line.productId)) || 0) + line.quantity);
  for (const [productId, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
    const product = await Product.findById(productId).session(session);
    const minimum = product ? effectiveMinimum(product, storeType) : 1;
    if (!product || product.status !== "ACTIVE") throw Object.assign(new Error("A product is no longer available. Refresh the catalogue."), { status: 400, expose: true });
    if (quantity < minimum) throw Object.assign(new Error(`${product.name}: minimum order is ${minimum} ${product.uom} for this store category.`), { status: 400, expose: true });
    const taken = await Product.findOneAndUpdate({ _id: productId, status: "ACTIVE", stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { new: true, session });
    if (!taken) throw Object.assign(new Error(`Not enough stock for ${product.name}. Refresh the catalogue and retry.`), { status: 400, expose: true });
  }
  const [order] = await Order.create([fields], { session });
  const [payment = null] = order.paidAmount > 0 ? await Payment.create([{
    orderId: order.orderId, consumerId: order.consumerId, agentId: order.agentId,
    amount: order.paidAmount, method: paymentMethod, collectionKind: "INITIAL", ...gateway,
    collectedBy: { id: order.agentId, role: "AGENT" },
    ...(needsVerification(paymentMethod) && { verification: pendingVerification(order.agentId) }),
  }], { session }) : [];
  const invoice = order.invoicePolicy === "ON_CONFIRMATION" ? null : await createInvoiceFromOrder(order, { session, generatePdf: false, throwOnError: true, initialPayment: payment });
  return { order, payment, invoice };
});
