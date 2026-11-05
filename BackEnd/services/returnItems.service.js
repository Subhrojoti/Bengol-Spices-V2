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
  const wholeOrderReturned = previous.some(entry => !entry.items?.length);
  return order.products.map((item, lineIndex) => {
    const reserved = previous.reduce((total, entry) => total + (entry.items || []).filter(line => line.lineIndex === lineIndex).reduce((sum, line) => sum + line.quantity, 0), 0);
    return {
      ...goodsOnly({ ...item, lineIndex, orderLineId: item._id ? String(item._id) : undefined }),
      orderedQuantity: item.quantity,
      remainingQuantity: wholeOrderReturned ? 0 : Math.max(0, item.quantity - reserved),
    };
  });
};

export const selectReturnItems = (order, available, requested) => {
  const legacy = requested === undefined;
  if (!legacy && (!Array.isArray(requested) || !requested.length || requested.length > 200)) refuse("Select at least one item to return");
  const wanted = legacy ? order.products.map((item, lineIndex) => ({ lineIndex, quantity: item.quantity })) : requested;
  const seen = new Set();
  return wanted.map(line => {
    if (!line || !Number.isInteger(line.lineIndex) || line.lineIndex < 0 || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || !available[line.lineIndex] || seen.has(line.lineIndex)) refuse("Select valid order items and whole quantities; do not repeat an item");
    seen.add(line.lineIndex);
    const current = available[line.lineIndex], original = order.products[line.lineIndex];
    if (line.orderLineId !== undefined && line.orderLineId !== current.orderLineId) refuse("The order items changed. Refresh before requesting a return.");
    if (line.quantity > current.remainingQuantity) refuse(`${original.name}: only ${current.remainingQuantity} ${original.uom} remain available to return`);
    return {
      ...goodsOnly(current), productId: original.productId,
      quantity: line.quantity, unitPrice: original.unitPrice,
      totalPrice: Math.round(original.unitPrice * line.quantity * 100) / 100,
    };
  });
};
