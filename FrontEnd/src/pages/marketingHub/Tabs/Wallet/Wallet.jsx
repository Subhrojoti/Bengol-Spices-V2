import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { toast } from "react-toastify";
import {
  getIncentiveSummary,
  getIncentiveHistory,
} from "../../../../api/services";

const Wallet = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const [summaryRes, historyRes] = await Promise.all([
        getIncentiveSummary(),
        getIncentiveHistory(),
      ]);

      if (summaryRes?.success) {
        setSummary(summaryRes);
      }

      if (historyRes?.success) {
        setHistory(historyRes.data);
      }
    } catch (err) {
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  if (loading) {
    return (
      <Box className="flex justify-center items-center h-[60vh]">
        <Typography>Loading wallet...</Typography>
      </Box>
    );
  }

  return (
    <Box className="p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <AccountBalanceWalletIcon className="text-green-600" />
        <Typography className="text-2xl font-bold">My Wallet</Typography>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Total Earned */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-green-100">
          <p className="text-sm text-gray-500">Total Earned</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            ₹{summary?.totalEarned || 0}
          </p>
        </div>

        {/* Credited */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-blue-100">
          <p className="text-sm text-gray-500">Credited to Bank</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            ₹{summary?.totalCredited || 0}
          </p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-orange-100">
          <p className="text-sm text-gray-500">Pending Amount</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            ₹{summary?.pending || 0}
          </p>
        </div>
      </div>

      {/* HISTORY */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <Typography className="font-semibold mb-4">
          Transaction History
        </Typography>

        {history.length === 0 ? (
          <p className="text-gray-400 text-center py-10">
            No transactions found
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => {
              const isCredit = item.type === "EARNING";

              return (
                <div
                  key={item._id}
                  className="flex justify-between items-center p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                  {/* LEFT */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        isCredit ? "bg-green-100" : "bg-red-100"
                      }`}>
                      {isCredit ? (
                        <ArrowDownwardIcon className="text-green-600 text-sm" />
                      ) : (
                        <ArrowUpwardIcon className="text-red-500 text-sm" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {isCredit ? "Incentive Earned" : "Payout"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.note || item.source}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        isCredit ? "text-green-600" : "text-red-500"
                      }`}>
                      {isCredit ? "+" : "-"}₹{item.amount}
                    </p>

                    <span className="text-xs text-gray-400">{item.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Box>
  );
};

export default Wallet;
