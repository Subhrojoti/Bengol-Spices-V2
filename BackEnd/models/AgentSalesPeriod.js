import mongoose from "mongoose";

/* One agent's sales target for one month.

   This is the record that makes the monthly reset safe. A new month gets a
   new document, starting from nothing; last month's stays exactly as it
   ended. Each holds the terms that applied in THAT month (the target, the
   working days, the incentive on offer) rather than pointing at the current
   settings, so changing a target next year cannot rewrite what an agent
   achieved, or was paid for, this year.

   Sales here are COLLECTED sales: the payments the agent took in the month.
   They are not stored while the month is running; they are added up from
   the payment records every time, so money on an order that is cancelled or
   returned during the month stops counting at once. When the month is over
   the final figures are written down (closedAt, finalSales) and no longer
   move. */

const agentSalesPeriodSchema = new mongoose.Schema(
  {
    agentId: {
      type: String, // BS2026-001
      required: true,
    },

    // The month on the Indian calendar: "2026-10"
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    /* ── the terms for this month ─────────────────────────────────── */

    // ₹. 0 means the agent had no mandatory target this month.
    monthlyTarget: { type: Number, min: 0, default: 0 },

    // A fixed number of working days, or null to count from the calendar
    workingDays: { type: Number, min: 1, max: 31, default: null },

    weeklyOffDays: { type: [Number], default: [0] },

    // Holidays and leave that fall in this month, "YYYY-MM-DD"
    daysOff: { type: [String], default: [] },

    incentive: {
      enabled: { type: Boolean, default: false },
      target: { type: Number, min: 0, default: 0 },
      reward: { type: Number, min: 0, default: 0 },
    },

    /* ── what happened ────────────────────────────────────────────── */

    // When sales first reached the mandatory target, and the amount it was
    // reached against. Once set it is never cleared: a later cancellation,
    // or the admin raising the target, does not un-achieve the month.
    mandatoryAchievedAt: { type: Date, default: null },
    mandatoryAchievedTarget: { type: Number, default: null },

    // When the agent chose "start earning incentives" in the app
    incentiveStartedAt: { type: Date, default: null },

    // When the additional target was reached, what was paid for it, and the
    // wallet entry that paid it. Set once; never taken back.
    incentiveEarnedAt: { type: Date, default: null },
    incentiveAmount: { type: Number, default: 0 },
    incentiveLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentIncentiveLedger",
      default: null,
    },

    /* ── written when the month is over ───────────────────────────── */

    closedAt: { type: Date, default: null },
    // Collected in the month, the orders it was collected on, and how many
    // collections there were
    finalSales: { type: Number, default: null },
    finalOrders: { type: Number, default: null },
    finalPayments: { type: Number, default: null },
  },
  { timestamps: true },
);

/* Exactly one record per agent per month. Two requests arriving together at
   the start of a month both try to create it; the loser hits this index and
   reads the winner's record. */
agentSalesPeriodSchema.index({ agentId: 1, month: 1 }, { unique: true });
agentSalesPeriodSchema.index({ month: 1 });

export default mongoose.model("AgentSalesPeriod", agentSalesPeriodSchema);
