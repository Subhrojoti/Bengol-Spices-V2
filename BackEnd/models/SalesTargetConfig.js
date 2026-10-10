import mongoose from "mongoose";

/* The standing settings for the monthly sales target.

   There is one DEFAULT document, which every agent follows, and at most one
   AGENT document per agent, holding only what was set differently for them.
   On an AGENT document a field left null means "use the default", so
   changing the default reaches every agent who was never customised.

   These are the settings a NEW month starts from. What applied in a given
   month is kept on that month's own record (AgentSalesPeriod), which is why
   editing these never rewrites a month that has already been worked. */

const incentiveSchema = new mongoose.Schema(
  {
    // Offered at all? Off, the agent sees only the mandatory target.
    enabled: { type: Boolean, default: null },
    // Sales to make ABOVE the mandatory target
    target: { type: Number, min: 0, default: null },
    // Paid once when that is reached
    reward: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const salesTargetConfigSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["DEFAULT", "AGENT"],
      required: true,
    },

    // BS2026-001. Empty on the DEFAULT document.
    agentId: {
      type: String,
      default: null,
    },

    // ₹ per month. 0 means no mandatory target.
    monthlyTarget: { type: Number, min: 0, default: null },

    /* A fixed number of working days ("works 24 days a month"). Null means
       count them from the calendar: the days of the month less weekly days
       off, holidays and leave. */
    workingDays: { type: Number, min: 1, max: 31, default: null },

    // Weekdays never worked: 0 = Sunday … 6 = Saturday. Absent means "not
    // set here" (an empty list is a real answer: works every day), which is
    // why this has no default: a list field would otherwise start as [].
    weeklyOffDays: { type: [Number], default: undefined },

    /* Dates not worked, "YYYY-MM-DD". On the DEFAULT document these are
       holidays for everyone; on an AGENT document, that agent's own leave
       and holidays. An agent's days off are the two lists together. */
    daysOff: { type: [String], default: [] },

    incentive: { type: incentiveSchema, default: () => ({}) },

    updatedBy: {
      id: String,
      name: String,
      role: String,
    },
  },
  { timestamps: true },
);

// One DEFAULT document, and one per agent
salesTargetConfigSchema.index({ scope: 1, agentId: 1 }, { unique: true });

export default mongoose.model("SalesTargetConfig", salesTargetConfigSchema);
