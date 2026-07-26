import { useEffect, useState } from "react";
import { getAgentDashboard } from "../../../../api/services";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Store,
  Target,
} from "lucide-react";

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

const Overview = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await getAgentDashboard();
      if (res?.success) setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!data) return <div className="p-6">Loading...</div>;

  const { summary, monthly } = data;

  const currentMonthIndex = new Date().getMonth();

  const monthlyMap = {};
  monthly.forEach((m) => {
    monthlyMap[m.month] = m;
  });

  const chartData = months.slice(0, currentMonthIndex + 1).map((month) => {
    const m = monthlyMap[month];
    return {
      month,
      sales: m?.sales ?? 0,
      collected: m?.collected ?? 0,
      due: m?.due ?? 0,
      ordersDelivered: m?.ordersDelivered ?? 0,
      cancelled: m?.cancelled ?? 0,
      incentive: summary.totalIncentive ?? 0,
    };
  });

  const salesStatusData = [
    { name: "Total Sales", value: summary.totalSalesAmount },
    { name: "Total Due", value: summary.totalDue },
  ];

  const COLORS = ["#22c55e", "#ef4444"];

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen space-y-6">
      {/* HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-10 -top-1 opacity-10 text-[120px]">
            ₹
          </div>

          <p className="text-sm opacity-80">Total Sales</p>
          <h1 className="text-4xl font-bold mt-2">
            ₹{summary.totalSalesAmount}
          </h1>

          <p className="text-sm mt-2 opacity-80">
            Collected: ₹{summary.totalCollected} • Due: ₹{summary.totalDue}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-6 space-y-4">
          <KpiItem
            icon={<CheckCircle size={18} />}
            label="Delivered"
            value={summary.totalOrdersDelivered}
            color="text-green-600"
          />
          <KpiItem
            icon={<XCircle size={18} />}
            label="Cancelled"
            value={summary.totalCancelled}
            color="text-red-500"
          />
          <KpiItem
            icon={<AlertTriangle size={18} />}
            label="Returns"
            value={summary.totalReturns}
            color="text-yellow-500"
          />
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <RadialMiniCard
          icon={<Store size={18} />}
          label="Stores Created"
          value={summary.totalStoresCreated}
          color="#f97316"
        />

        <SparkCard
          icon={<Wallet size={18} />}
          label="Collected"
          value={`₹${summary.totalCollected}`}
          color="#22c55e"
          data={chartData}
          dataKey="collected"
        />

        <SparkCard
          icon={<TrendingUp size={18} />}
          label="Incentive"
          value={`₹${summary.totalIncentive}`}
          color="#6366f1"
          data={chartData}
          dataKey="incentive"
        />

        <RadialMiniCard
          icon={<Target size={18} />}
          label="Targets Achieved"
          value={summary.targetAchievedCount}
          color="#3b82f6"
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAIN CHART */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl p-6">
          <h2 className="text-lg font-semibold mb-6">Monthly Performance</h2>

          <div className="h-[350px]">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>

                  <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>

                  <linearGradient id="due" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />

                <Area dataKey="sales" stroke="#3b82f6" fill="url(#sales)" />
                <Area
                  dataKey="collected"
                  stroke="#22c55e"
                  fill="url(#collected)"
                />
                <Area dataKey="due" stroke="#f59e0b" fill="url(#due)" />
                <Area
                  dataKey="ordersDelivered"
                  stroke="#6366f1"
                  fillOpacity={0}
                />
                <Area dataKey="cancelled" stroke="#ef4444" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ===== ORDER STATUS DONUT ===== */}
        <div className="bg-white rounded-3xl shadow border p-6">
          <h3 className="text-md font-semibold mb-6">Sales Status</h3>

          <div className="h-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={salesStatusData}
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value">
                  {salesStatusData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Sales</span>
              <span className="font-medium">{summary.totalSalesAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Due</span>
              <span className="font-medium">{summary.totalDue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;

/* COMPONENTS */

const KpiItem = ({ icon, label, value, color }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-gray-600">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    <span className={`font-semibold ${color}`}>{value}</span>
  </div>
);

const SparkCard = ({ icon, label, value, color, data, dataKey }) => {
  const gradientId = `${label}-gradient`;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {icon}
        {label}
      </div>

      <h3 className="text-xl font-semibold mt-2" style={{ color }}>
        {value}
      </h3>

      <div className="h-[50px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* NEW RADIAL KPI */

const RadialMiniCard = ({ icon, label, value, color }) => {
  const chartData = [
    { name: "value", value: value || 0 },
    { name: "rest", value: 10 }, // small background ring
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition relative">
      {/* LEFT CONTENT */}
      <div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          {icon}
          {label}
        </div>

        <h3 className="text-xl font-semibold mt-2" style={{ color }}>
          {value}
        </h3>
      </div>

      {/* RIGHT CENTERED RADIAL */}
      <div className="absolute right-5 top-1/2 -translate-y-1/2">
        <div className="w-[60px] h-[60px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={18}
                outerRadius={28}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none">
                <Cell fill={color} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
