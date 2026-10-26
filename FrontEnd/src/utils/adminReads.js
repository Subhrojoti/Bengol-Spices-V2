// Share simultaneous Admin GETs only. There is no stale-data cache: completed
// requests are removed, and starting a mutation invalidates pending reuse.
const pending = new Map();
export const invalidateAdminReads = () => pending.clear();
export const reuseAdminRead = (key, request) => {
  if (pending.has(key)) return pending.get(key);
  const promise = request().finally(() => { if (pending.get(key) === promise) pending.delete(key); });
  pending.set(key, promise);
  return promise;
};
