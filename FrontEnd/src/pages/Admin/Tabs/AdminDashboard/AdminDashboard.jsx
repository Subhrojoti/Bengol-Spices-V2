import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  AlertCircle,
  RefreshCcw,
  Trophy,
  Package,
  User,
  Users,
  UserCheck,
  Store,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { getDashboardSummary } from "../../../../api/services";

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      const res = await getDashboardSummary();
      if (res.success) setData(res.data);
    };
    fetchDashboard();
  }, []);

  if (!data) return null;

  const { counts, orderStats, charts, insights, financials } = data;

  const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div className="min-h-screen bg-gray-100 p-8 space-y-10">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-gray-800 tracking-tight">
          Dashboard
        </h1>
        <div className="text-xs text-gray-400">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
      {/* KPI CARDS */}
      <div className="grid grid-cols-4 gap-6">
        {[
          {
            label: "Total Sales",
            value: financials.totalSales,
            gradient: "from-indigo-500 via-indigo-600 to-indigo-700",
            icon: <IndianRupee size={18} />,
          },
          {
            label: "Profit",
            value: financials.profit,
            gradient: "from-emerald-500 via-green-600 to-green-700",
            icon: <TrendingUp size={18} />,
          },
          {
            label: "Total Due",
            value: financials.totalDue,
            gradient: "from-amber-400 via-orange-500 to-orange-600",
            icon: <AlertCircle size={18} />,
          },
          {
            label: "Refund",
            value: financials.totalRefund,
            gradient: "from-rose-400 via-red-500 to-red-600",
            icon: <RefreshCcw size={18} />,
          },
        ].map((item, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-xl bg-gradient-to-br ${item.gradient}`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>

            <div className="flex items-center justify-between">
              <p className="text-sm opacity-80">{item.label}</p>
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur">
                {item.icon}
              </div>
            </div>

            <h2 className="text-3xl font-bold mt-4 tracking-tight">
              ₹ {item.value.toLocaleString()}
            </h2>

            <div className="mt-5 h-[3px] w-12 bg-white/40 rounded-full"></div>
          </div>
        ))}
      </div>
      {/* PREMIUM COUNTS WITH ICONS  */}
      <div className="grid grid-cols-6 gap-5">
        {Object.entries(counts).map(([key, value]) => {
          const config = {
            orders: {
              icon: <Package size={18} />,
              color: "from-indigo-500 to-indigo-600",
              text: "text-indigo-600",
              bg: "bg-indigo-50",
            },
            agents: {
              icon: <UserCheck size={18} />,
              color: "from-green-500 to-emerald-600",
              text: "text-green-600",
              bg: "bg-green-50",
            },
            employees: {
              icon: <Users size={18} />,
              color: "from-purple-500 to-violet-600",
              text: "text-purple-600",
              bg: "bg-purple-50",
            },
            stores: {
              icon: <Store size={18} />,
              color: "from-orange-400 to-orange-600",
              text: "text-orange-600",
              bg: "bg-orange-50",
            },
            products: {
              icon: <ShoppingCart size={18} />,
              color: "from-pink-500 to-rose-600",
              text: "text-rose-600",
              bg: "bg-rose-50",
            },
            deliveryPartners: {
              icon: <Truck size={18} />,
              color: "from-cyan-500 to-blue-600",
              text: "text-cyan-600",
              bg: "bg-cyan-50",
            },
          };

          const item = config[key] || {};

          return (
            <div
              key={key}
              className="relative overflow-hidden rounded-2xl p-4 shadow-md bg-white border border-gray-100">
              {/* subtle gradient glow */}
              <div
                className={`absolute inset-0 opacity-20 bg-gradient-to-br ${item.color} blur-xl`}></div>

              <div className="relative z-10 flex items-center justify-between">
                {/* LEFT */}
                <div>
                  <p className="text-xs text-gray-400 capitalize mb-1">{key}</p>

                  <h3
                    className={`text-xl font-bold tracking-tight ${item.text}`}>
                    {value}
                  </h3>
                </div>

                {/* ICON */}
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-lg ${item.bg} shadow-inner ${item.text}`}>
                  {item.icon}
                </div>
              </div>

              {/* bottom accent */}
              <div
                className={`mt-3 h-[3px] w-8 rounded-full bg-gradient-to-r ${item.color}`}></div>
            </div>
          );
        })}
      </div>
      {/* MAIN CHART */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 relative rounded-3xl p-[1px] bg-gradient-to-br from-indigo-200 via-purple-200 to-cyan-200 shadow-xl">
          <div className="bg-white/90 backdrop-blur rounded-3xl p-6">
            <h2 className="mb-4 font-semibold text-gray-700">
              Revenue & Profit Overview
            </h2>

            <ResponsiveContainer height={360}>
              <AreaChart data={charts.revenue}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>

                  <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="url(#sales)"
                />

                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#22c55e"
                  strokeWidth={3}
                  fill="url(#profit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PIE */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <h2 className="mb-4 font-semibold text-gray-700">
            Order Distribution
          </h2>

          <ResponsiveContainer height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: "Cancelled", value: orderStats.cancelled },
                  { name: "Delivered", value: orderStats.delivered },
                  { name: "Pending", value: orderStats.pendingPayments },
                ]}
                innerRadius={60}
                outerRadius={90}
                dataKey="value">
                {COLORS.map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* INSIGHTS IMPROVED */}
      <div className="grid grid-cols-3 gap-6">
        {/* TOP PRODUCTS */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <div className="flex items-center gap-2 mb-4">
            <Package size={18} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-700">Top Products</h2>
          </div>

          <div className="space-y-4">
            {insights.topProducts.map((item, i) => {
              const max = insights.topProducts[0]?.revenue || 1;
              const width = (item.revenue / max) * 100;

              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item._id}</span>
                    <span className="font-medium">₹ {item.revenue}</span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${width}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP AGENTS */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-green-500" />
            <h2 className="font-semibold text-gray-700">Top Agents</h2>
          </div>

          <div className="space-y-4">
            {insights.topAgents.map((item, i) => {
              const max = insights.topAgents[0]?.sales || 1;
              const width = (item.sales / max) * 100;

              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item._id}</span>
                    <span className="font-medium">₹ {item.sales}</span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-600"
                      style={{ width: `${width}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STATE SALES */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-yellow-500" />
            <h2 className="font-semibold text-gray-700">State Sales</h2>
          </div>

          <ResponsiveContainer height={260}>
            <BarChart data={insights.stateSales}>
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />

              <Bar dataKey="sales" fill="#6366f1" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
