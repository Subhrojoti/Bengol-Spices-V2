import {
  agentDetail,
  currentViewFor,
  historyFor,
  overview,
  saveSettings,
  startIncentive,
} from "../services/salesTarget.service.js";
import SalesTargetChange from "../models/SalesTargetChange.js";
import Agent from "../models/Agent.js";
import { isMonthKey } from "../utils/salesTarget.js";

const refuse = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

// Who is making a change, for the change log
const actorOf = (req) => ({
  id: req.user?._id ? String(req.user._id) : null,
  name: req.user?.role === "ADMIN" ? "Admin" : req.user?.name || "Employee",
  role: req.user?.role || null,
});

/* =====================================================
   AGENT: MY SALES TARGET THIS MONTH

   Always the signed-in agent's own. The agent ID comes from the login, never
   from the request, so there is nothing an agent could change in the
   address to read someone else's.
===================================================== */
export const getMySalesTarget = async (req, res) => {
  try {
    const data = await currentViewFor(req.user.agentId);

    return res.json({ success: true, data, serverTime: new Date() });
  } catch (error) {
    console.error("MY SALES TARGET ERROR:", error);
    return refuse(res, "Failed to load your sales target", 500);
  }
};

/* =====================================================
   AGENT: MY TARGET AND INCENTIVE HISTORY
===================================================== */
export const getMySalesTargetHistory = async (req, res) => {
  try {
    const data = await historyFor(req.user.agentId);

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("MY SALES TARGET HISTORY ERROR:", error);
    return refuse(res, "Failed to load your target history", 500);
  }
};

/* =====================================================
   AGENT: START EARNING THE ADDITIONAL INCENTIVE
   Only once the mandatory target for the month is achieved
===================================================== */
export const startMyIncentive = async (req, res) => {
  try {
    const result = await startIncentive(req.user.agentId);

    if (result.error) return refuse(res, result.error);

    return res.json({ success: true, data: result.view });
  } catch (error) {
    console.error("START INCENTIVE ERROR:", error);
    return refuse(res, "Failed to start the incentive", 500);
  }
};

/* =====================================================
   OFFICE: EVERY AGENT'S MONTH
   ?month=YYYY-MM for an earlier month; the running month otherwise
===================================================== */
export const getSalesTargetOverview = async (req, res) => {
  try {
    const { month } = req.query;

    if (month !== undefined && !isMonthKey(month)) {
      return refuse(res, "Month must be written as YYYY-MM");
    }

    return res.json({ success: true, data: await overview({ month }) });
  } catch (error) {
    console.error("SALES TARGET OVERVIEW ERROR:", error);
    return refuse(res, "Failed to load sales targets", 500);
  }
};

/* =====================================================
   OFFICE: ONE AGENT IN FULL
   Settings, the running month, history and the change log
===================================================== */
export const getAgentSalesTarget = async (req, res) => {
  try {
    const data = await agentDetail(String(req.params.agentId));

    if (!data) return refuse(res, "Agent not found", 404);

    return res.json({ success: true, data });
  } catch (error) {
    console.error("AGENT SALES TARGET ERROR:", error);
    return refuse(res, "Failed to load this agent's sales target", 500);
  }
};

const save = (agentIdOf) => async (req, res) => {
  try {
    const { applyFrom, ...body } = req.body || {};

    const result = await saveSettings({
      agentId: agentIdOf(req),
      body,
      applyFrom: applyFrom === undefined ? "THIS_MONTH" : applyFrom,
      actor: actorOf(req),
    });

    if (result.error) return refuse(res, result.error, result.status || 400);

    return res.json({
      success: true,
      changed: result.changed,
      // Anything that could not take effect in the running month, in words
      notes: result.notes,
      effectiveMonth: result.effectiveMonth,
      message: !result.changed
        ? "Nothing was changed"
        : `Saved. Applies from ${result.effectiveLabel}.`,
    });
  } catch (error) {
    console.error("SAVE SALES TARGET ERROR:", error);
    return refuse(res, "Failed to save the sales target", 500);
  }
};

/* =====================================================
   OFFICE: CHANGE THE DEFAULT, OR ONE AGENT'S OWN SETTINGS

   Body: any of monthlyTarget, workingDays, weeklyOffDays, daysOff,
   incentive { enabled, target, reward }. A field left out is not touched;
   null puts it back (an agent's back to the default). applyFrom is
   THIS_MONTH (the default) or NEXT_MONTH.
===================================================== */
export const saveDefaultSalesTarget = save(() => null);
export const saveAgentSalesTarget = save((req) => String(req.params.agentId));

/* =====================================================
   OFFICE: THE CHANGE LOG
   ?agentId= for one agent's (with the defaults they follow)
===================================================== */
export const getSalesTargetChanges = async (req, res) => {
  try {
    const agentId =
      typeof req.query.agentId === "string" ? req.query.agentId : null;

    const changes = await SalesTargetChange.find(
      agentId ? { $or: [{ agentId }, { scope: "DEFAULT" }] } : {},
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const named = await Agent.find({
      agentId: { $in: changes.map((c) => c.agentId).filter(Boolean) },
    })
      .select("agentId name")
      .lean();
    const names = Object.fromEntries(named.map((a) => [a.agentId, a.name]));

    return res.json({
      success: true,
      count: changes.length,
      data: changes.map((change) => ({
        ...change,
        agentName: change.agentId ? names[change.agentId] || null : null,
      })),
    });
  } catch (error) {
    console.error("SALES TARGET CHANGES ERROR:", error);
    return refuse(res, "Failed to load the change log", 500);
  }
};
