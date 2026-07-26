import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Avatar,
} from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PaymentsIcon from "@mui/icons-material/Payments";
import { getTargetPerformance } from "../../../../../api/services";

export default function TargetPerformance() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      const res = await getTargetPerformance();
      const rawData = res?.data || [];

      const grouped = Object.values(
        rawData.reduce((acc, item) => {
          const agentId = item.agentId;

          if (!acc[agentId]) {
            acc[agentId] = {
              agentId,
              agentName: agentId,
              completedTarget: 0,
              totalTarget: 0,
              totalEarned: 0,
              targets: {},
            };
          }

          acc[agentId].completedTarget += item.achievedValue || 0;
          acc[agentId].totalTarget += item.count || item.achievedValue;
          acc[agentId].totalEarned += item.earnedAmount || 0;

          const type = item.type;
          if (!acc[agentId].targets[type]) {
            acc[agentId].targets[type] = 0;
          }
          acc[agentId].targets[type] += item.achievedValue || 0;

          return acc;
        }, {}),
      );

      setData(grouped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ================= HELPERS =================
  const getColor = (value) => {
    if (value >= 80) return "#22c55e";
    if (value >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const formatType = (type) => {
    switch (type) {
      case "STORE_CREATION":
        return "Store";
      case "ORDER":
        return "Orders";
      case "PAYMENT":
        return "Payments";
      default:
        return type;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "STORE_CREATION":
        return <StoreIcon sx={{ fontSize: 14 }} />;
      case "ORDER":
        return <ShoppingCartIcon sx={{ fontSize: 14 }} />;
      case "PAYMENT":
        return <PaymentsIcon sx={{ fontSize: 14 }} />;
      default:
        return null;
    }
  };

  const getBg = (type) => {
    switch (type) {
      case "STORE_CREATION":
        return "#e0f2fe";
      case "ORDER":
        return "#ede9fe";
      case "PAYMENT":
        return "#dcfce7";
      default:
        return "#f1f5f9";
    }
  };

  // ================= LOADING =================
  if (loading) {
    return (
      <Box
        sx={{
          height: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <CircularProgress />
      </Box>
    );
  }

  // ================= UI =================
  return (
    <Box sx={{ p: 3, bgcolor: "#f8fafc", borderRadius: 3 }}>
      {/* ✅ FALLBACK UI */}
      {data.length === 0 ? (
        <Box
          sx={{
            height: "75vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
          }}>
          <Avatar
            sx={{
              bgcolor: "#e2e8f0",
              width: 60,
              height: 60,
              mb: 2,
            }}>
            <BarChartIcon sx={{ fontSize: 40, color: "#64748b" }} />
          </Avatar>

          <Typography fontSize={16} fontWeight={600}>
            No Data Available
          </Typography>

          <Typography variant="body">
            Target performance data will appear here
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {data.map((agent, index) => {
            const total = agent.totalTarget || 0;
            const completed = agent.completedTarget || 0;
            const progress =
              total > 0 ? Math.round((completed / total) * 100) : 0;

            const color = getColor(progress);

            return (
              <Grid
                item
                key={index}
                sx={{
                  width: 260,
                }}>
                <Card
                  sx={{
                    borderRadius: 4,
                    height: 290,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    p: 1,
                    background: "linear-gradient(180deg, #ffffff, #f1f5f9)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
                    transition: "0.25s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.1)",
                    },
                  }}>
                  <CardContent>
                    {/* HEADER */}
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar
                        sx={{
                          bgcolor: "#6366f1",
                          width: 38,
                          height: 38,
                          fontSize: 14,
                          mr: 1,
                        }}>
                        {agent.agentName?.charAt(0)}
                      </Avatar>

                      <Box>
                        <Typography fontWeight={600} fontSize={14}>
                          {agent.agentName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Agent
                        </Typography>
                      </Box>
                    </Box>

                    {/* RADIAL PROGRESS */}
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      position="relative"
                      mb={2}>
                      <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={80}
                        thickness={5}
                        sx={{
                          color,
                        }}
                      />

                      <Box
                        position="absolute"
                        display="flex"
                        flexDirection="column"
                        alignItems="center">
                        <Typography fontWeight={700} fontSize={16}>
                          {progress}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Done
                        </Typography>
                      </Box>
                    </Box>

                    {/* TARGET BREAKDOWN */}
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {Object.entries(agent.targets || {}).map(
                        ([type, value]) => (
                          <Box
                            key={type}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              px: 1,
                              py: 0.5,
                              borderRadius: 2,
                              fontSize: 11,
                              background: getBg(type),
                            }}>
                            {getIcon(type)}
                            <span>
                              {formatType(type)} ({value})
                            </span>
                          </Box>
                        ),
                      )}
                    </Box>
                  </CardContent>

                  {/* FOOTER */}
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    px={2}
                    pb={1}>
                    <Typography variant="body" color="text.secondary">
                      {completed}/{total}
                    </Typography>

                    <Typography
                      variant="body"
                      sx={{ fontWeight: 700, color: "#16a34a" }}>
                      ₹{agent.totalEarned}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
