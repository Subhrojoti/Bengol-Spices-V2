import Order from "../models/Order.js";
import Return from "../models/Return.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import Store from "../models/store.js";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";
import Product from "../models/Product.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";

export const getAgentDashboard = async ({ agentId, from, to }) => {
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const orderMatch = {
    agentId,
    createdAt: { $gte: start, $lte: end },
  };

  const returnMatch = {
    agentId,
    createdAt: { $gte: start, $lte: end },
  };

  const storeMatch = {
    registeredBy: agentId,
  };

  // =========================
  // 🚀 PARALLEL (EXCEPT INCENTIVE)
  // =========================
  const [orderData, returnData, progressData, storeCount] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalOrdersDelivered: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0],
                  },
                },
                totalCancelled: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0],
                  },
                },
                totalSalesAmount: { $sum: "$totalAmount" },
                totalCollected: { $sum: "$paidAmount" },
                totalDue: { $sum: "$dueAmount" },
              },
            },
          ],
          monthly: [
            {
              $group: {
                _id: {
                  month: { $month: "$createdAt" },
                  year: { $year: "$createdAt" },
                },
                ordersDelivered: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0],
                  },
                },
                cancelled: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0],
                  },
                },
                sales: { $sum: "$totalAmount" },
                collected: { $sum: "$paidAmount" },
                due: { $sum: "$dueAmount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
        },
      },
    ]),

    Return.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
        },
      },
    ]),

    AgentTargetProgress.aggregate([
      {
        $match: { agentId },
      },
      {
        $group: {
          _id: null,
          targetAchievedCount: {
            $sum: {
              $cond: [{ $eq: ["$isCompleted", true] }, 1, 0],
            },
          },
        },
      },
    ]),

    Store.countDocuments(storeMatch),
  ]);

  // =========================
  // 💰 INCENTIVE (EXACT COPY FROM WORKING API)
  // =========================
  const incentiveSummary = await AgentIncentiveLedger.aggregate([
    {
      $match: { agentId },
    },
    {
      $group: {
        _id: "$agentId",
        totalEarned: {
          $sum: {
            $cond: [{ $eq: ["$type", "EARNING"] }, "$amount", 0],
          },
        },
        totalPaid: {
          $sum: {
            $cond: [{ $eq: ["$type", "PAYOUT"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  const earned = incentiveSummary[0]?.totalEarned || 0;
  const paid = incentiveSummary[0]?.totalPaid || 0;
  const netIncentive = earned - paid;

  // =========================
  // 🧠 FORMAT
  // =========================
  const summary = orderData[0]?.summary[0] || {};
  const returns = returnData[0]?.totalReturns || 0;
  const progress = progressData[0] || {};

  const monthNames = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthly = (orderData[0]?.monthly || []).map((m) => ({
    month: monthNames[m._id.month],
    year: m._id.year,
    ordersDelivered: m.ordersDelivered,
    cancelled: m.cancelled,
    sales: m.sales,
    collected: m.collected,
    due: m.due,
  }));

  const fillMissingMonths = (monthly, from, to) => {
    const result = [];
    const start = new Date(from);
    const end = new Date(to);

    const monthMap = {};
    monthly.forEach((m) => {
      monthMap[`${m.month}-${m.year}`] = m;
    });

    const current = new Date(start);

    while (current <= end) {
      const month = current.toLocaleString("default", { month: "short" });
      const year = current.getFullYear();

      const key = `${month}-${year}`;

      result.push(
        monthMap[key] || {
          month,
          year,
          ordersDelivered: 0,
          cancelled: 0,
          sales: 0,
          collected: 0,
          due: 0,
        },
      );

      current.setMonth(current.getMonth() + 1);
    }

    return result;
  };

  const finalMonthly = fillMissingMonths(monthly, from, to);

  const calculateGrowth = (monthly) => {
    if (monthly.length < 2) return 0;

    const last = monthly[monthly.length - 1].sales;
    const prev = monthly[monthly.length - 2].sales;

    if (prev === 0) return 100;

    return (((last - prev) / prev) * 100).toFixed(2);
  };

  // console.log("DASHBOARD AGENT ID:", agentId);
  // const rawLedger = await AgentIncentiveLedger.find({ agentId });
  // console.log("RAW LEDGER DATA:", rawLedger);
  // console.log("INCENTIVE AGG:", incentiveSummary);

  // =========================
  // 🎯 FINAL
  // =========================
  return {
    summary: {
      totalOrdersDelivered: summary.totalOrdersDelivered || 0,
      totalCancelled: summary.totalCancelled || 0,
      totalReturns: returns,
      totalSalesAmount: summary.totalSalesAmount || 0,
      totalCollected: summary.totalCollected || 0,
      totalDue: summary.totalDue || 0,

      // ✅ FIXED (SHOW EARNED INSTEAD OF NET)
      totalIncentive: earned,

      totalEarned: earned,
      totalPaid: paid,

      targetAchievedCount: progress.targetAchievedCount || 0,
      totalStoresCreated: storeCount || 0,
    },

    monthly: finalMonthly,
    growth: {
      salesGrowth: calculateGrowth(finalMonthly),
    },
  };
};
// Admin Dashboard Service
export const getAdminDashboard = async ({ year }) => {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // =========================
  // 🚀 PARALLEL QUERIES (FIXED ORDER)
  // =========================
  const [
    totalOrders,
    totalAgents,
    totalEmployees,
    totalStores,
    totalProducts,
    totalDeliveryPartners,

    deliveredOrders,
    cancelledOrders,
    pendingPayments,
    totalReturns,

    revenueData,
    returnsData,
    monthlyOrders,

    topAgents,
    topProducts,
    stateSales,

    profitData,
    returnAmountData,
  ] = await Promise.all([
    // ================= COUNTS =================
    Order.countDocuments(),
    Agent.countDocuments(),
    Employee.countDocuments(),
    Store.countDocuments(),
    Product.countDocuments(),
    DeliveryPartner.countDocuments(),

    // ================= ORDER STATS =================
    Order.countDocuments({ status: "DELIVERED" }),
    Order.countDocuments({ status: "CANCELLED" }),
    Order.countDocuments({ paymentStatus: "PENDING" }),
    Return.countDocuments({
      createdAt: { $gte: startOfYear, $lte: endOfYear },
    }),

    // ================= REVENUE =================
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          sales: { $sum: "$totalAmount" },
          collected: { $sum: "$paidAmount" },
          due: { $sum: "$dueAmount" },
          profit: { $sum: "$paidAmount" }, // ✅ consistent logic
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // ================= RETURNS =================
    Return.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          returns: { $sum: 1 },
        },
      },
    ]),

    // ================= ORDERS =================
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          delivered: {
            $sum: {
              $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0],
            },
          },
        },
      },
    ]),

    // ================= TOP AGENTS =================
    Order.aggregate([
      {
        $match: {
          status: "DELIVERED",
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: "$agentId",
          sales: { $sum: "$totalAmount" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
    ]),

    // ================= TOP PRODUCTS =================
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.name",
          revenue: { $sum: "$products.totalPrice" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),

    // ================= STATE SALES =================
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: "$deliveryAddress.state",
          sales: { $sum: "$totalAmount" },
        },
      },
      { $sort: { sales: -1 } },
    ]),

    // ================= PROFIT =================
    Order.aggregate([
      {
        $match: {
          status: "DELIVERED",
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalDue: { $sum: "$dueAmount" },
          totalCollected: { $sum: "$paidAmount" },
        },
      },
    ]),

    // ================= REFUNDS =================
    Return.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: null,
          totalRefund: { $sum: "$refund.amount" },
        },
      },
    ]),
  ]);

  // =========================
  // 🧠 CLEAN FORMATTERS
  // =========================

  const mapByMonth = (data = []) => {
    const map = {};
    data.forEach((d) => {
      if (d && d._id) map[d._id] = d;
    });
    return map;
  };

  const revenueMap = mapByMonth(revenueData);
  const returnsMap = mapByMonth(returnsData);
  const ordersMap = mapByMonth(monthlyOrders);

  // ✅ Revenue
  const revenueMonthly = months.map((month, i) => {
    const val = revenueMap[i + 1] || {};
    return {
      month,
      sales: val.sales || 0,
      collected: val.collected || 0,
      due: val.due || 0,
      profit: val.profit || 0,
    };
  });

  // ✅ Returns
  const returnsMonthly = months.map((month, i) => {
    const val = returnsMap[i + 1] || {};
    return {
      month,
      returns: val.returns || 0,
    };
  });

  // ✅ Orders
  const ordersMonthly = months.map((month, i) => {
    const val = ordersMap[i + 1] || {};
    return {
      month,
      delivered: val.delivered || 0,
      cancelled: val.cancelled || 0,
    };
  });

  // =========================
  // 💰 FINAL FINANCIALS
  // =========================

  const totalSales = profitData?.[0]?.totalSales || 0;
  const totalDue = profitData?.[0]?.totalDue || 0;
  const totalCollected = profitData?.[0]?.totalCollected || 0;
  const totalRefund = returnAmountData?.[0]?.totalRefund || 0;
  const returnRate =
    totalOrders > 0
      ? Number(((totalReturns / totalOrders) * 100).toFixed(2))
      : 0;

  const profit = totalCollected - totalRefund;

  return {
    counts: {
      orders: totalOrders,
      agents: totalAgents,
      employees: totalEmployees,
      stores: totalStores,
      products: totalProducts,
      deliveryPartners: totalDeliveryPartners,
    },

    orderStats: {
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      pendingPayments,
      totalReturns,
      returnRate,
    },

    charts: {
      revenue: revenueMonthly,
      returns: returnsMonthly,
      orders: ordersMonthly,
    },

    insights: {
      topAgents,
      topProducts,
      stateSales,
    },

    financials: {
      totalSales,
      totalRefund,
      totalDue,
      profit,
    },
  };
};
