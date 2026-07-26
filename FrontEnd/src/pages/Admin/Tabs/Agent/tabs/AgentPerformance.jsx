import { useEffect, useState, useMemo } from "react";
import { getAgentPerformance } from "../../../../../api/services";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

export default function AgentPerformance() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const res = await getAgentPerformance();
        setData(res.data || []);
      } catch (err) {
        console.error("Failed to fetch performance", err);
      }
    };

    fetchPerformance();
  }, []);

  /* ================= KPIs ================= */
  const totalCollection = useMemo(
    () => data.reduce((sum, a) => sum + a.totalCollected, 0),
    [data],
  );

  const totalTransactions = useMemo(
    () => data.reduce((sum, a) => sum + a.transactions, 0),
    [data],
  );

  const avgCollection = data.length
    ? (totalCollection / data.length).toFixed(2)
    : 0;

  const topAgent = useMemo(() => {
    return data.reduce(
      (max, a) => (a.totalCollected > (max?.totalCollected || 0) ? a : max),
      null,
    );
  }, [data]);

  /* ================= CHART DATA FIX ================= */
  // Create wave even if single data
  const chartData =
    data.length === 1
      ? [
          { ...data[0], _id: "Start", totalCollected: 0 },
          data[0],
          {
            ...data[0],
            _id: "End",
            totalCollected: data[0].totalCollected * 0.8,
          },
        ]
      : data;

  return (
    <div className="p-4 space-y-4">
      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: `₹ ${totalCollection}`,
            color: "bg-blue-100 text-blue-700",
          },
          {
            label: "Txns",
            value: totalTransactions,
            color: "bg-green-100 text-green-700",
          },
          {
            label: "Avg",
            value: `₹ ${avgCollection}`,
            color: "bg-purple-100 text-purple-700",
          },
          {
            label: "Top",
            value: topAgent ? topAgent._id : "-",
            color: "bg-orange-100 text-orange-700",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl px-3 py-2 shadow-sm ${item.color}`}>
            <p className="text-xs font-medium opacity-70">{item.label}</p>
            <p className="text-sm font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ================= CHART ================= */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-700">
          Collection Trend
        </h2>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />

            <Area
              type="monotone"
              dataKey="totalCollected"
              stroke="#3b82f6"
              fill="url(#colorWave)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ================= TABLE ================= */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Agent ID</th>
              <th className="text-left px-4 py-2">Total</th>
              <th className="text-left px-4 py-2">Txns</th>
              <th className="text-left px-4 py-2">Avg</th>
            </tr>
          </thead>

          <tbody>
            {data.map((agent) => (
              <tr
                key={agent._id}
                className="border-t hover:bg-gray-50 transition">
                <td className="px-4 py-2">{agent._id}</td>
                <td className="px-4 py-2 font-medium text-blue-600">
                  ₹ {agent.totalCollected}
                </td>
                <td className="px-4 py-2">{agent.transactions}</td>
                <td className="px-4 py-2">
                  ₹{" "}
                  {agent.transactions
                    ? (agent.totalCollected / agent.transactions).toFixed(2)
                    : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
