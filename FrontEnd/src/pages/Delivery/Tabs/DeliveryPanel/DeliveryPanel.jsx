import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

import { getDeliveryPartnerDashboard } from "../../../../api/services";

const DeliveryPanel = () => {
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await getDeliveryPartnerDashboard();
      if (response?.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    }
  };

  if (!dashboardData) return <div className="p-8">Loading dashboard...</div>;

  const { summary, monthlyDeliveryDistribution, yearlyComparison } =
    dashboardData;

  const deliveredTrend = monthlyDeliveryDistribution.map((m, index) => ({
    month: m.month,
    value:
      m.delivered && m.delivered > 0
        ? m.delivered
        : Math.round((summary.totalDelivered / 12) * (index + 1)),
  }));

  const returnTrend = monthlyDeliveryDistribution.map((m, index) => ({
    month: m.month,
    value:
      m.returns && m.returns > 0
        ? m.returns
        : Math.round((summary.totalReturnsHandled / 12) * (index + 1)),
  }));

  const pendingTrend = monthlyDeliveryDistribution.map((m, index) => ({
    month: m.month,
    value:
      summary.totalPendingPickups > 0
        ? Math.round((summary.totalPendingPickups / 12) * (index + 1))
        : 0,
  }));

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-[100svh] md:min-h-screen space-y-6 md:space-y-10">
      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-8xl mx-auto">
        {/* Delivered */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow">
          <p className="text-gray-500 text-sm">Total Delivered</p>
          <h2 className="text-xl md:text-2xl font-bold text-green-600 mb-3">
            {summary.totalDelivered}
          </h2>

          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={deliveredTrend}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Returns */}
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-gray-500 text-sm">Total Returns Handled</p>
          <h2 className="text-2xl font-bold text-red-600 mb-3">
            {summary.totalReturnsHandled}
          </h2>

          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={returnTrend}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pending Pickups */}
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-gray-500 text-sm">Pending Pickups</p>
          <h2 className="text-2xl font-bold text-yellow-600 mb-3">
            {summary.totalPendingPickups}
          </h2>

          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={pendingTrend}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MONTHLY DISTRIBUTION */}
      <div className="bg-white p-4 md:p-8 rounded-xl shadow max-w-8xl mx-auto">
        <h2 className="text-lg font-semibold mb-6">
          Monthly Delivery Distribution
        </h2>

        <ResponsiveContainer width="100%" height={220} className="md:h-[300px]">
          <AreaChart data={monthlyDeliveryDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Area
              type="monotone"
              dataKey="delivered"
              stackId="1"
              stroke="#16a34a"
              fill="#22c55e"
              fillOpacity={0.7}
            />

            <Area
              type="monotone"
              dataKey="returns"
              stackId="1"
              stroke="#dc2626"
              fill="#ef4444"
              fillOpacity={0.7}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* YEARLY COMPARISON */}
      <div className="bg-white p-8 rounded-xl shadow max-w-8xl mx-auto">
        <h2 className="text-lg font-semibold mb-6 text-center">
          Yearly Delivery Comparison
        </h2>

        <ResponsiveContainer width="100%" height={180} className="md:h-[300px]">
          <RadialBarChart
            innerRadius="20%"
            outerRadius="90%"
            data={yearlyComparison}
            startAngle={180}
            endAngle={0}>
            <PolarAngleAxis
              type="number"
              domain={[0, "dataMax"]}
              tick={false}
            />

            <Tooltip
              formatter={(value) => [value, "Delivered"]}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.year}
            />

            <RadialBar
              dataKey="delivered"
              cornerRadius={10}
              fill="#6366f1"
              background
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Year labels */}
        <div className="flex justify-center gap-6 md:gap-20 mt-4 flex-wrap">
          {yearlyComparison.map((year) => (
            <div key={year.year} className="text-center">
              <p className="text-sm text-gray-500">{year.year}</p>
              <p className="font-semibold text-indigo-600">{year.delivered}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeliveryPanel;
