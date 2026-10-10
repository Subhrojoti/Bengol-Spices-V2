import mongoose from "mongoose";
import { productSales } from "../services/sales.service.js";
import {
  dateKeyOf,
  dayRange,
  isDateKey,
  monthKeyOf,
  monthRange,
} from "../utils/salesTarget.js";

const refuse = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const MAX_DAYS = 800;

/* The period a report covers. from and to are Indian calendar dates and
   both are included; with neither, it is the running month to date. Returns
   { from, to, start, end } with [start, end) as instants, or { error }. */
const readRange = (query) => {
  const today = dateKeyOf(new Date());

  const to = query.to === undefined ? today : query.to;
  const from =
    query.from === undefined ? `${monthKeyOf(new Date())}-01` : query.from;

  if (!isDateKey(from) || !isDateKey(to)) {
    return { error: "from and to must be dates written as YYYY-MM-DD" };
  }
  if (from > to) return { error: "The start date is after the end date" };

  const start = dayRange(from).start;
  const end = dayRange(to).end;

  if ((end - start) / 86400000 > MAX_DAYS) {
    return { error: "Choose a period of two years or less" };
  }

  return { from, to, start, end };
};

const readGroupBy = (value) =>
  ["day", "week", "month"].includes(value) ? value : null;

/* =====================================================
   OFFICE: PRODUCT-WISE SALES

   Three figures per product, kept apart: what was ORDERED in the period
   (quantity and order value), what was COLLECTED in the period, and what
   is still OUTSTANDING on those orders. See services/sales.service.js.

   The whole business, or one agent with ?agentId=. ?productId= narrows the
   totals, the trend and the per-agent split to one product.
   ?groupBy=day|week|month sets the steps of the trend.
===================================================== */
export const getProductSales = async (req, res) => {
  try {
    const range = readRange(req.query);
    if (range.error) return refuse(res, range.error);

    const agentId =
      typeof req.query.agentId === "string" && req.query.agentId.trim()
        ? req.query.agentId.trim()
        : null;

    const productId =
      typeof req.query.productId === "string" && req.query.productId.trim()
        ? req.query.productId.trim()
        : null;

    if (productId && !mongoose.isValidObjectId(productId)) {
      return refuse(res, "Not a valid product");
    }

    const groupBy =
      req.query.groupBy === undefined ? "day" : readGroupBy(req.query.groupBy);
    if (!groupBy) return refuse(res, "groupBy must be day, week or month");

    const data = await productSales({
      from: range.start,
      to: range.end,
      agentId,
      productId,
      groupBy,
      // The business view shows who sold it; one agent's view has no need
      withAgents: !agentId,
      withUnsold: true,
    });

    return res.json({
      success: true,
      from: range.from,
      to: range.to,
      agentId,
      productId,
      groupBy,
      data,
    });
  } catch (error) {
    console.error("PRODUCT SALES ERROR:", error);
    return refuse(res, "Failed to load product sales", 500);
  }
};

/* =====================================================
   AGENT: MY PRODUCT-WISE SALES

   Only ever the signed-in agent's own orders: the agent ID is taken from
   the login and anything in the request that names another agent is
   ignored. ?month=YYYY-MM, or ?from=&to=; the running month otherwise.
===================================================== */
export const getMyProductSales = async (req, res) => {
  try {
    let range;

    if (req.query.month !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month))) {
        return refuse(res, "Month must be written as YYYY-MM");
      }

      const { start, end } = monthRange(req.query.month);
      range = {
        from: `${req.query.month}-01`,
        to: dateKeyOf(new Date(end.getTime() - 1)),
        start,
        end,
      };
    } else {
      range = readRange(req.query);
      if (range.error) return refuse(res, range.error);
    }

    const data = await productSales({
      from: range.start,
      to: range.end,
      agentId: req.user.agentId,
      groupBy: "day",
      withAgents: false,
      // An agent sees what they have not sold too: that is the point
      withUnsold: true,
    });

    return res.json({
      success: true,
      from: range.from,
      to: range.to,
      data: { totals: data.totals, products: data.products },
    });
  } catch (error) {
    console.error("MY PRODUCT SALES ERROR:", error);
    return refuse(res, "Failed to load your product sales", 500);
  }
};
