// Shared defensive helpers for unwrapping API responses. React Query
// requires a query function to NEVER resolve to undefined — if it does,
// the whole query crashes hard with "Query data cannot be undefined."
// These helpers guarantee a safe fallback (empty array / null) no matter
// what shape actually comes back from the server, so a wrong assumption
// about response shape degrades gracefully instead of crashing the app.

// 🔥 Widened significantly — a response wrapped as {stores: [...]} or
// {orders: [...]} etc. was silently falling through to an empty array
// before, since only "data" was checked. This tries every common key name
// first, then falls back to "the one array-valued property in the
// response, whatever it's called" as a last resort.
// 🔥 Widened further — "products" (and other entity-specific names) were
// missing from the first pass, which is exactly why the product catalog
// still came back empty. Also now checks one level of nesting, in case
// the real shape is doubly-wrapped, e.g. {success, data: {products: [...]}}.
const LIST_KEYS = [
  "data",
  "stores",
  "orders",
  "products",
  "targets",
  "notifications",
  "faqs",
  "returns",
  "leaderboard",
  "catalog",
  "results",
  "list",
  "items",
  "records",
];

function findArrayByKey(obj: Record<string, unknown>): unknown[] | null {
  for (const key of LIST_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

export function unwrapList<T>(responseData: unknown): T[] {
  if (Array.isArray(responseData)) return responseData as T[];

  const body = (responseData ?? {}) as Record<string, unknown>;

  const direct = findArrayByKey(body);
  if (direct) return direct as T[];

  // One level deeper, e.g. {success, data: {products: [...], total: 10}}.
  for (const key of LIST_KEYS) {
    const nested = body[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = findArrayByKey(nested as Record<string, unknown>);
      if (found) return found as T[];
    }
  }

  const arrayValues = Object.values(body).filter(Array.isArray);
  if (arrayValues.length === 1) return arrayValues[0] as T[];

  return [];
}

export function unwrapObject<T>(responseData: unknown): T | null {
  const body = (responseData ?? {}) as Record<string, unknown>;
  const candidate = "data" in body ? body.data : body;
  if (candidate && typeof candidate === "object") return candidate as T;
  return null;
}
