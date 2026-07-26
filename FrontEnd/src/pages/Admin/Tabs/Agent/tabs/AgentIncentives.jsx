import React, { useEffect, useState } from "react";
import { getIncentiveList, payoutIncentive } from "../../../../../api/services";

const AgentIncentive = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);

  const fetchIncentives = async () => {
    try {
      setLoading(true);
      const res = await getIncentiveList();
      setData(res?.data || []);
    } catch (err) {
      console.error("Error fetching incentives:", err);
      alert("Failed to fetch incentive list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncentives();
  }, []);

  const handlePayout = async (agent) => {
    try {
      setPayingId(agent.agentId);

      const payload = {
        agentId: agent.agentId,
        amount: agent.pending,
        note: "Incentive payout",
      };

      await payoutIncentive(payload);

      alert("Payout successful ✅");
      fetchIncentives(); // refresh data
    } catch (err) {
      console.error(err);
      alert(err?.message || "Payout failed ❌");
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40 text-gray-500">
        Loading incentives...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-[80vh]">
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((agent) => (
          <div
            key={agent.agentId}
            className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-all duration-300">
            {/* Top Section */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  {agent.name}
                </h3>
                <p className="text-xs text-gray-500">{agent.agentId}</p>
              </div>

              <span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600">
                {agent.state || "N/A"}
              </span>
            </div>

            {/* Contact */}
            <p className="text-sm text-gray-600 mt-2">{agent.phone}</p>

            {/* Divider */}
            <div className="my-4 border-t"></div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Earned</p>
                <p className="font-semibold text-green-600">
                  ₹{agent.totalEarned}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Paid</p>
                <p className="font-semibold text-blue-600">
                  ₹{agent.totalPaid}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="font-semibold text-red-500">₹{agent.pending}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600"
                  style={{
                    width: `${
                      agent.totalEarned
                        ? (agent.totalPaid / agent.totalEarned) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Pay Button */}
            <button
              disabled={agent.pending === 0 || payingId === agent.agentId}
              onClick={() => handlePayout(agent)}
              className={`mt-5 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  agent.pending === 0
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-90"
                }`}>
              {payingId === agent.agentId
                ? "Processing..."
                : agent.pending === 0
                  ? "No Pending"
                  : `Pay ₹${agent.pending}`}
            </button>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {data.length === 0 && !loading && (
        <div className="text-center text-gray-500 mt-10">
          No incentives found
        </div>
      )}
    </div>
  );
};

export default AgentIncentive;
