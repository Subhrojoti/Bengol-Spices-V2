import {
  MAX_BULK,
  approveCashPayment,
  approveCashPayments,
  cashPaymentsOfAgent,
  getCashPayment,
  listCashPayments,
  rejectCashPayment,
  verificationSummary,
} from "../services/cashVerification.service.js";

const refuse = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

/* Who is deciding, for the payment's history. Taken from the login, never
   from the request, so a decision cannot be signed with someone else's
   name. */
const actorOf = (req) => ({
  id: req.user?._id ? String(req.user._id) : null,
  role: req.user?.role || null,
  name: req.user?.role === "ADMIN" ? "Admin" : req.user?.name || "Employee",
});

/* =====================================================
   OFFICE: CASH WAITING TO BE VERIFIED, AND WHAT WAS DECIDED
   ?status=PENDING|APPROVED|REJECTED|ALL  ?agentId=  ?from=&to= (collected)
===================================================== */
export const getCashPayments = async (req, res) => {
  try {
    const list = await listCashPayments({
      status: req.query.status,
      agentId: req.query.agentId,
      from: req.query.from,
      to: req.query.to,
    });

    if (list.error) return refuse(res, list.error);

    return res.json({
      success: true,
      count: list.rows.length,
      truncated: list.truncated,
      summary: await verificationSummary(),
      data: list.rows,
    });
  } catch (error) {
    console.error("CASH PAYMENTS ERROR:", error);
    return refuse(res, "Failed to load cash payments", 500);
  }
};

/* =====================================================
   OFFICE: ONE PAYMENT WITH ITS FULL HISTORY
===================================================== */
export const getCashPaymentDetail = async (req, res) => {
  try {
    const data = await getCashPayment(req.params.paymentId);
    if (!data) return refuse(res, "Payment not found", 404);

    return res.json({ success: true, data });
  } catch (error) {
    console.error("CASH PAYMENT DETAIL ERROR:", error);
    return refuse(res, "Failed to load this payment", 500);
  }
};

/* =====================================================
   OFFICE: APPROVE ONE
===================================================== */
export const approveCash = async (req, res) => {
  try {
    const result = await approveCashPayment({
      paymentId: req.params.paymentId,
      note: req.body?.note,
      actor: actorOf(req),
    });

    if (!result.ok) return refuse(res, result.message, result.code);

    return res.json({
      success: true,
      message: "Payment approved. It now counts toward the agent's sales.",
      data: await getCashPayment(req.params.paymentId),
    });
  } catch (error) {
    console.error("CASH APPROVE ERROR:", error);
    return refuse(res, "Could not approve this payment", 500);
  }
};

/* =====================================================
   OFFICE: APPROVE SEVERAL (the cash handed in together)
===================================================== */
export const approveCashBulk = async (req, res) => {
  try {
    const ids = req.body?.paymentIds;

    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
      return refuse(res, "Choose at least one payment to approve");
    }
    if (ids.length > MAX_BULK) {
      return refuse(res, `Approve at most ${MAX_BULK} payments at a time`);
    }

    const { approved, skipped } = await approveCashPayments({
      paymentIds: ids,
      note: req.body?.note,
      actor: actorOf(req),
    });

    const done = `${approved.length} payment${approved.length === 1 ? "" : "s"} approved`;

    return res.json({
      success: true,
      message: skipped.length
        ? `${done}. ${skipped.length} could not be: ${skipped[0].message}`
        : `${done}.`,
      approved,
      skipped,
    });
  } catch (error) {
    console.error("CASH BULK APPROVE ERROR:", error);
    return refuse(res, "Could not approve these payments", 500);
  }
};

/* =====================================================
   OFFICE: REJECT ONE (a reason is required)
===================================================== */
export const rejectCash = async (req, res) => {
  try {
    const result = await rejectCashPayment({
      paymentId: req.params.paymentId,
      reason: req.body?.reason,
      actor: actorOf(req),
    });

    if (!result.ok) return refuse(res, result.message, result.code);

    return res.json({
      success: true,
      message: "Payment rejected. It does not count toward the agent's sales.",
      data: await getCashPayment(req.params.paymentId),
    });
  } catch (error) {
    console.error("CASH REJECT ERROR:", error);
    return refuse(res, "Could not reject this payment", 500);
  }
};

/* =====================================================
   AGENT: MY CASH AND WHERE EACH PAYMENT STANDS

   Always the signed-in agent's own; the agent ID comes from the login. An
   agent can read this and nothing more: there is no address an agent can
   call to approve, reject or change a payment's verification.
===================================================== */
export const getMyCashPayments = async (req, res) => {
  try {
    const data = await cashPaymentsOfAgent(req.user.agentId, {
      status: req.query.status,
    });

    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("MY CASH PAYMENTS ERROR:", error);
    return refuse(res, "Failed to load your cash payments", 500);
  }
};
