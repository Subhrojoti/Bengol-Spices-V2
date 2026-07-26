import { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, Chip } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StoreIcon from "@mui/icons-material/Store";
import PaymentsIcon from "@mui/icons-material/Payments";
import { toast } from "react-toastify";
import { getDailyTarget } from "../../../../api/services";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";

const Targets = () => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTarget = async () => {
    try {
      const res = await getDailyTarget();

      if (res?.success && (!res.targets || res.targets.length === 0)) {
        setTargets([]);
        return;
      }

      if (res?.success) {
        const merged = res.targets.map((t) => {
          const progressItem = res.progress?.find((p) => p.targetId === t._id);

          return {
            ...t,
            achievedValue: progressItem?.achievedValue || 0,
            earnedAmount: progressItem?.earnedAmount || 0,
            isCompleted: progressItem?.isCompleted || false,
          };
        });

        setTargets(merged);
      } else {
        toast.error(res?.message || "Failed to fetch target");
      }
    } catch (err) {
      console.error("Target API error:", err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarget();
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case "STORE_CREATION":
        return <StoreIcon className="text-blue-500" />;
      case "ORDER":
        return <ShoppingCartIcon className="text-purple-500" />;
      case "PAYMENT":
        return <PaymentsIcon className="text-green-500" />;
      default:
        return <TrackChangesIcon />;
    }
  };

  if (loading) {
    return (
      <Box className="flex justify-center items-center h-[60vh]">
        <Typography>Loading targets...</Typography>
      </Box>
    );
  }

  if (!targets.length) {
    return (
      <Box className="flex flex-col justify-center items-center h-[80vh]">
        <TrackChangesIcon sx={{ fontSize: 60, color: "#9ca3af" }} />
        <Typography className="mt-3 text-gray-500">
          No targets assigned
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <Typography className="text-2xl font-bold text-center mb-8 tracking-tight">
        Today’s Targets
      </Typography>

      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
        {targets.map((target) => {
          const cappedAchieved = Math.min(
            target.achievedValue,
            target.targetValue,
          );

          const isOverachieved = target.achievedValue > target.targetValue;

          const percentage = Math.min(
            (target.achievedValue / target.targetValue) * 100,
            100,
          );

          const chartData = [
            {
              value: percentage,
              fill: target.isCompleted ? "#22c55e" : "#6366f1",
            },
          ];

          const getGradient = () => {
            switch (target.type) {
              case "STORE_CREATION":
                return "from-blue-500/10 to-blue-100";
              case "ORDER":
                return "from-purple-500/10 to-purple-100";
              case "PAYMENT":
                return "from-green-500/10 to-green-100";
              default:
                return "from-gray-200 to-gray-100";
            }
          };

          return (
            <div
              key={target._id}
              className={`rounded-3xl p-[1px] bg-gradient-to-br ${getGradient()} shadow-md hover:shadow-2xl transition-all`}>
              <div className="bg-white rounded-3xl p-5 h-full flex flex-col justify-between">
                {/* HEADER */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gray-100">
                      {getIcon(target.type)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {target.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {target.type.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      target.isCompleted
                        ? "bg-green-100 text-green-600"
                        : "bg-orange-100 text-orange-600"
                    }`}>
                    {target.isCompleted ? "Completed" : "In Progress"}
                  </span>
                </div>

                {/* REWARD */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EmojiEventsIcon className="text-yellow-500" />
                    <span className="text-lg font-semibold text-gray-800">
                      ₹{target.rewardAmount}
                    </span>
                  </div>

                  {target.type === "ORDER" &&
                    target.productCommissions.length > 0 && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-md">
                        ₹{target.productCommissions[0].commissionPerUnit}/unit
                      </span>
                    )}
                </div>

                {/* PROGRESS */}
                <div className="relative h-[160px] mt-3">
                  <ResponsiveContainer>
                    <RadialBarChart
                      innerRadius="72%"
                      outerRadius="100%"
                      data={chartData}
                      startAngle={90}
                      endAngle={-270}>
                      <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        tick={false}
                      />
                      <RadialBar dataKey="value" cornerRadius={20} background />
                    </RadialBarChart>
                  </ResponsiveContainer>

                  {/* CENTER */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {percentage.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400">Completed</p>
                  </div>
                </div>

                {/* STATS */}
                <div className="text-center mt-2">
                  <p className="text-sm text-gray-600">
                    {cappedAchieved} / {target.targetValue}
                  </p>

                  {isOverachieved && (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      +{target.achievedValue - target.targetValue} extra
                    </p>
                  )}
                </div>

                {/* FOOTER */}
                <div className="mt-4">
                  <div
                    className={`text-sm text-center px-3 py-2 rounded-xl ${
                      target.isCompleted
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-50 text-gray-600"
                    }`}>
                    {target.isCompleted
                      ? isOverachieved
                        ? `Earned ₹${target.earnedAmount} 🎉 + extra effort 💪`
                        : `Earned ₹${target.earnedAmount} 🎉`
                      : `Complete ${
                          target.targetValue - target.achievedValue
                        } more to earn ₹${target.rewardAmount}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Box>
    </Box>
  );
};

export default Targets;
