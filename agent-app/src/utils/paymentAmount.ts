/** Never treat an empty field as permission to collect the whole balance. */
export function explicitPaymentAmount(text: string, due: number, cash: boolean): number | null {
  const value = text.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const paise = Math.round(Number(value) * 100), outstanding = Math.round(due * 100);
  if (!Number.isSafeInteger(paise) || !Number.isSafeInteger(outstanding) || paise <= 0 || paise > outstanding || paise < 100 && !(cash && paise === outstanding)) return null;
  return paise / 100;
}

/** Advance is optional; invalid text never silently becomes a full payment. */
export function advancePaymentAmount(text: string, total: number): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null;
  const paise = Math.round(Number(text.trim()) * 100), limit = Math.round(total * 100);
  if (!Number.isSafeInteger(paise) || !Number.isSafeInteger(limit) || paise < 0 || paise > limit) return null;
  return paise / 100;
}
export function collectionMonth(date: string | Date, now = Date.now()): "EARLIER" | "CURRENT" | "UNKNOWN" {
  const placed = new Date(date).getTime();
  if (!Number.isFinite(placed)) return "UNKNOWN";
  const month = (instant: number) => new Date(instant + 330 * 60000).toISOString().slice(0, 7);
  return month(placed) < month(now) ? "EARLIER" : "CURRENT";
}
