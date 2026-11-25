import Return from "../models/Return.js";

const refuse = message => { throw Object.assign(new Error(message), { status: 400 }); };
export const goodsOnly = item => ({
  lineIndex: item.lineIndex, orderLineId: item.orderLineId,
  name: item.name, quantity: item.quantity, uom: item.uom, image: item.image,
});

// A pending pickup reserves its quantity too. Cancellation releases it;
// warehouse receipt does not make the same goods returnable a second time.
export const availableReturnItems = async (order, session = null) => {
  const previous = await Return.find({ orderId: order.orderId, status: { $ne: "CANCELLED" } }).session(session).lean();
  return remainingOrderItems(order, previous);
};

export const remainingOrderItems = (order, previous) => {
  const wholeOrderReturned = previous.some(entry => !entry.items?.length);
  const reserved = new Map();
  for (const entry of previous) {
    for (const line of entry.items || []) {
      reserved.set(line.lineIndex, (reserved.get(line.lineIndex) || 0) + line.quantity);
    }
  }
  return order.products.map((item, lineIndex) => {
    return {
      ...goodsOnly({ ...item, lineIndex, orderLineId: item._id ? String(item._id) : undefined }),
      orderedQuantity: item.quantity,
      remainingQuantity: wholeOrderReturned ? 0 : Math.max(0, item.quantity - (reserved.get(lineIndex) || 0)),
    };
  });
};

export const selectReturnItems = (order, available, requested) => {
  const legacy = requested === undefined;
  if (!legacy && (!Array.isArray(requested) || !requested.length || requested.length > 200)) refuse("Select at least one item to return");
  const wanted = legacy ? order.products.map((item, lineIndex) => ({ lineIndex, quantity: item.quantity })) : requested;
  const seen = new Set();
  return wanted.map(line => {
    if (!line || !Number.isInteger(line.lineIndex) || line.lineIndex < 0 || !available[line.lineIndex] || seen.has(line.lineIndex)) refuse("Select valid order items; do not repeat an item");
    seen.add(line.lineIndex);
    const current = available[line.lineIndex], original = order.products[line.lineIndex];
    // A legacy order measured by weight or volume can have a fractional
    // remainder. It can be taken back in full, with its exact saved quantity.
    const measuredRemainder = ["kg", "gm", "ltr"].includes(original.uom) && line.quantity === current.remainingQuantity;
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.quantity) && !measuredRemainder) {
      refuse("Select whole quantities or the full remaining weight or volume");
    }
    if (line.orderLineId !== undefined && line.orderLineId !== current.orderLineId) refuse("The order items changed. Refresh before requesting a return.");
    if (line.quantity > current.remainingQuantity) refuse(`${original.name}: only ${current.remainingQuantity} ${original.uom} remain available to return`);
    return {
      ...goodsOnly(current), productId: original.productId,
      quantity: line.quantity, unitPrice: original.unitPrice,
      totalPrice: Math.round(original.unitPrice * line.quantity * 100) / 100,
    };
  });
};
