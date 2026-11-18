import type { ItemReturnInput } from "@/api/return.api";

export const returnAttemptKey = (actorId: string, orderId: string) => `itemReturn.${actorId}.${orderId}`.replace(/[^A-Za-z0-9._-]/g, "_");

export function parseReturnAttempt(raw: string, actorId: string, orderId: string): ItemReturnInput {
  const fail = () => { throw new Error("The saved return needs review. Retry loading it; if this continues, contact the office before recording another return."); };
  let record;
  try { record = JSON.parse(raw); } catch { return fail(); }
  const input = record?.input;
  if (record?.version !== 1 || record.actorId !== actorId || record.orderId !== orderId || typeof input?.requestId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(input.requestId) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 1000 || !Array.isArray(input.items) || !input.items.length || input.items.length > 200) return fail();
  const seen = new Set();
  for (const item of input.items) {
    if (!item || !Number.isSafeInteger(item.lineIndex) || item.lineIndex < 0 || seen.has(item.lineIndex) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.orderLineId !== undefined && (typeof item.orderLineId !== "string" || item.orderLineId.length > 100)) return fail();
    seen.add(item.lineIndex);
  }
  return { requestId: input.requestId, reason: input.reason, items: input.items.map((item: ItemReturnInput["items"][number]) => ({ lineIndex: item.lineIndex, quantity: item.quantity, ...(item.orderLineId !== undefined && { orderLineId: item.orderLineId }) })) };
}
