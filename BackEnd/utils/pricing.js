import AgentSalesLocation from "../models/AgentSalesLocation.js";

/* =====================================================================
   PRODUCT PRICING

   Every product carries default prices for the four store types (retailer,
   wholesaler, distributor and HoReCa: hotels, restaurants, caterers), the
   same across India. A territory assignment (agent + state) may carry
   location prices for some products. The rule, used both when the agent
   sees the catalogue and when the server prices an order:

     location price for that store type, if set  →  otherwise the default
   ===================================================================== */

export const TIER_FIELDS = {
  RETAILER: "retailerPrice",
  WHOLESALER: "wholesalerPrice",
  DISTRIBUTOR: "distributorPrice",
  HORECA: "horecaPrice",
};

export const STORE_TYPES = Object.keys(TIER_FIELDS);

const isPrice = (value) => typeof value === "number" && value > 0;

/**
 * The location prices that apply to one agent's stores in one state, as a
 * map keyed by product id. Empty when nothing has been set.
 */
export const getLocationOverrides = async (agentId, state) => {
  if (!agentId || !state) return new Map();

  const assignment = await AgentSalesLocation.findOne({
    agentId,
    state: String(state).toUpperCase(),
  })
    .select("priceOverrides")
    .lean();

  const map = new Map();
  for (const entry of assignment?.priceOverrides || []) {
    map.set(String(entry.productId), entry);
  }
  return map;
};

/**
 * A product's tier prices after the location override is applied, plus
 * which tiers came from the location, so the apps can label them.
 */
export const applyLocationPrices = (product, override) => {
  const prices = {};
  const fromLocation = {};

  for (const field of Object.values(TIER_FIELDS)) {
    const local = override?.[field];
    fromLocation[field] = isPrice(local);
    prices[field] = fromLocation[field] ? local : (product[field] ?? null);
  }

  return { ...prices, fromLocation };
};

/**
 * The single price to charge a store of the given type. Falls back through
 * the product's catalogue prices when no tier price exists at all.
 */
export const effectivePrice = (product, storeType, override) => {
  const field = TIER_FIELDS[storeType];
  const local = override?.[field];
  if (isPrice(local)) return { price: local, source: "location" };

  const tier = product[field];
  if (isPrice(tier)) return { price: tier, source: "default" };

  const fallback = [product.discountPrice, product.price].find(isPrice);
  return fallback != null
    ? { price: fallback, source: "default" }
    : { price: null, source: null };
};
