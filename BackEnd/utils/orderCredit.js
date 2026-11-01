const DAY = 86400000;
const DELIVERY_DAYS = { RETAILER: 7, WHOLESALER: 10, HORECA: 7 };

// Snapshot only for new orders; absence of this marker preserves legacy dates.
export const newOrderCredit = (storeType, now = new Date()) => {
  const days = DELIVERY_DAYS[storeType];
  return days ? { dueDate: null, creditPolicy: { version: 1, basis: "DELIVERY", days } }
    : { dueDate: new Date(now.getTime() + 7 * DAY) };
};
export const deliveredCredit = (order, now) => {
  if (order.creditPolicy?.version !== 1 || order.creditPolicy.basis !== "DELIVERY" || order.creditPolicy.startedAt) return {};
  if (![7, 10].includes(order.creditPolicy.days)) throw new Error("Invalid saved credit period; contact the office");
  return { dueDate: new Date(now.getTime() + order.creditPolicy.days * DAY), "creditPolicy.startedAt": now };
};
