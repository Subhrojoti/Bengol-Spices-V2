import * as SecureStore from "expo-secure-store";
export interface OfflineCollection { id: string; amount: number; method: "CASH" | "UPI"; note?: string }
const key = (actorId: string, orderId: string) => `collection.${actorId}.${orderId}`.replace(/[^A-Za-z0-9._-]/g, "_");
export const readOfflineCollection = async (actorId: string, orderId: string): Promise<OfflineCollection | null> => {
  const saved = await SecureStore.getItemAsync(key(actorId, orderId));
  if (!saved) return null;
  const attempt = JSON.parse(saved) as OfflineCollection;
  if (!attempt.id || !Number.isFinite(attempt.amount) || attempt.amount <= 0 || !["CASH", "UPI"].includes(attempt.method)) throw new Error("Saved payment attempt needs office review");
  return attempt;
};
export const saveOfflineCollection = (actorId: string, orderId: string, attempt: OfflineCollection) => SecureStore.setItemAsync(key(actorId, orderId), JSON.stringify(attempt));
export const clearOfflineCollection = (actorId: string, orderId: string) => SecureStore.deleteItemAsync(key(actorId, orderId));
