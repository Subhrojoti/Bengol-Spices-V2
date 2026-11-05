const UNKNOWN_MONTH = "UNKNOWN";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function orderMonthKey(instant?: string | null): string {
  const time = instant ? new Date(instant).getTime() : NaN;
  const shifted = new Date(time + 330 * 60000);
  return Number.isFinite(shifted.getTime()) ? shifted.toISOString().slice(0, 7) : UNKNOWN_MONTH;
}

export function orderMonthLabel(key: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) ? `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}` : "Date not recorded";
}

/** Local buckets grow in place: copying the entire month for every row is quadratic. */
export function groupOrderHistory<T extends { order: { createdAt?: string | null; orderId: string }; monthKey: string }>(rows: T[]): { key: string; rows: T[] }[] {
  const months = new Map<string, T[]>();
  for (const row of rows) {
    const month = months.get(row.monthKey);
    if (month) month.push(row);
    else months.set(row.monthKey, [row]);
  }
  return [...months].sort(([a], [b]) => a === b ? 0 : a === UNKNOWN_MONTH ? 1 : b === UNKNOWN_MONTH ? -1 : b.localeCompare(a)).map(([key, values]) => ({
    key,
    rows: values.sort((a, b) => {
      const aTime = new Date(a.order.createdAt || "").getTime(), bTime = new Date(b.order.createdAt || "").getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0) || b.order.orderId.localeCompare(a.order.orderId);
    }),
  }));
}
