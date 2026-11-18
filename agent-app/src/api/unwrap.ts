// Shared defensive helpers for unwrapping API responses. React Query
// requires a query function to NEVER resolve to undefined — if it does,
// the whole query crashes hard with "Query data cannot be undefined."
// Unsupported wrappers fall back to an empty array / null. Entity arrays
// containing invalid rows become query errors before a renderer crashes;
// records are never silently dropped to make a malformed list look valid.

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

function recordList<T>(rows: unknown[]): T[] {
  // Every consumer is a list of entities. Do not pass null rows into a
  // FlatList renderer or silently remove them and report an incorrect count.
  if (!rows.every(row => row !== null && typeof row === "object" && !Array.isArray(row))) {
    throw new Error("The server returned incomplete list data. Please refresh and try again.");
  }
  return rows as T[];
}

export function unwrapList<T>(responseData: unknown): T[] {
  if (Array.isArray(responseData)) return recordList<T>(responseData);

  const body = (responseData ?? {}) as Record<string, unknown>;

  const direct = findArrayByKey(body);
  if (direct) return recordList<T>(direct);

  // One level deeper, e.g. {success, data: {products: [...], total: 10}}.
  for (const key of LIST_KEYS) {
    const nested = body[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = findArrayByKey(nested as Record<string, unknown>);
      if (found) return recordList<T>(found);
    }
  }

  const arrayValues = Object.values(body).filter(Array.isArray);
  if (arrayValues.length === 1) return recordList<T>(arrayValues[0]);

  return [];
}

export function unwrapObject<T>(responseData: unknown): T | null {
  if (!responseData || typeof responseData !== "object" || Array.isArray(responseData)) return null;
  const body = (responseData ?? {}) as Record<string, unknown>;
  const candidate = "data" in body ? body.data : body;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as T;
  return null;
}
