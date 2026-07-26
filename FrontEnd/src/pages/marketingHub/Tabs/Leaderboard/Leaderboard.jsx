import { useEffect, useState } from "react";
import { getLeaderboard } from "../../../../api/services";

const Leaderboard = () => {
  const [leaders, setLeaders] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await getLeaderboard();
      if (res.success) {
        const sorted = res.data.sort((a, b) => a.rank - b.rank);
        setLeaders(sorted.slice(0, 3));
        setData(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-500">
        Loading leaderboard...
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:p-6">
      {/* Title */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Leaderboard</h2>

      {/* 🔥 Top 3 Cards (Enhanced) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {leaders.map((user, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-md p-5 text-center hover:shadow-lg transition">
            <div className="text-2xl mb-2">{user.medal}</div>

            <img
              src={user.profileImage}
              alt={user.name}
              className="w-16 h-16 rounded-full mx-auto object-cover mb-3"
            />

            <h3 className="font-semibold text-gray-800">{user.name}</h3>
            <p className="text-xs text-gray-500">{user.agentId}</p>
            <p className="text-xs text-gray-400 mb-3">{user.state}</p>

            {/* 💰 Earnings */}
            <div className="bg-green-50 text-green-700 text-sm font-semibold py-1 rounded-lg mb-3">
              ₹{user.earnedAmount} Earned
            </div>

            {/* 📊 Stats */}
            <div className="grid grid-cols-3 gap-2 text-sm mt-2">
              <div>
                <p className="text-gray-400 text-xs">Sales</p>
                <p className="font-semibold text-indigo-600">₹{user.sales}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Orders</p>
                <p className="font-semibold">{user.ordersDelivered}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Targets</p>
                <p className="font-semibold text-orange-500">
                  {user.completedTargets}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 📊 Table */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="px-5 py-3 border-b text-sm text-gray-500 font-medium">
          All staff
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            {/* Header */}
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left w-[120px]">Rank</th>
                <th className="px-4 py-3 text-left w-[280px]">Agent</th>

                <th className="px-4 py-3 text-center">Target Achieved</th>
                <th className="px-4 py-3 text-center">Orders Delivered</th>
                <th className="px-4 py-3 text-center">Sales</th>
                <th className="px-4 py-3 text-center">Collected</th>
                <th className="px-4 py-3 text-center">Returns</th>
                <th className="px-4 py-3 text-center">Stores</th>
                <th className="px-4 py-3 text-center">Earned</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {data.map((user, index) => (
                <tr
                  key={index}
                  className={`border-b last:border-none hover:bg-gray-50 transition ${
                    user.rank <= 3 ? "bg-yellow-50/40" : ""
                  }`}>
                  {/* Rank */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{user.medal}</span>
                      <span>{user.rank}</span>
                    </div>
                  </td>

                  {/* Agent */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.profileImage}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.agentId}</p>
                        <p className="text-xs text-gray-400">{user.state}</p>
                      </div>
                    </div>
                  </td>

                  {/* New Column */}
                  <td className="px-4 py-3 text-center text-orange-500 font-medium">
                    {user.completedTargets}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {user.ordersDelivered}
                  </td>

                  <td className="px-4 py-3 text-center text-indigo-600 font-medium">
                    ₹{user.sales}
                  </td>

                  <td className="px-4 py-3 text-center">₹{user.collected}</td>

                  <td className="px-4 py-3 text-center">{user.returns}</td>

                  <td className="px-4 py-3 text-center">
                    {user.storesCreated}
                  </td>

                  {/* 💰 Earned */}
                  <td className="px-4 py-3 text-center text-green-600 font-semibold">
                    ₹{user.earnedAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3 p-3">
          {data.map((user, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl shadow-sm p-3 border ${
                user.rank <= 3 ? "bg-yellow-50/40" : ""
              }`}>
              {/* TOP */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>{user.medal}</span>
                  <span className="font-semibold">{user.rank}</span>
                </div>

                <div className="text-green-600 font-semibold text-sm">
                  ₹{user.earnedAmount}
                </div>
              </div>

              {/* AGENT */}
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={user.profileImage}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />

                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.agentId}</p>
                  <p className="text-xs text-gray-400">{user.state}</p>
                </div>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-3 gap-2 text-center mt-3 text-xs">
                <div>
                  <p className="text-gray-400">Sales</p>
                  <p className="font-semibold text-indigo-600">₹{user.sales}</p>
                </div>

                <div>
                  <p className="text-gray-400">Orders</p>
                  <p className="font-semibold">{user.ordersDelivered}</p>
                </div>

                <div>
                  <p className="text-gray-400">Targets</p>
                  <p className="font-semibold text-orange-500">
                    {user.completedTargets}
                  </p>
                </div>
              </div>

              {/* EXTRA */}
              <div className="grid grid-cols-3 gap-2 text-center mt-2 text-xs">
                <div>
                  <p className="text-gray-400">Collected</p>
                  <p className="font-semibold">₹{user.collected}</p>
                </div>

                <div>
                  <p className="text-gray-400">Returns</p>
                  <p className="font-semibold">{user.returns}</p>
                </div>

                <div>
                  <p className="text-gray-400">Stores</p>
                  <p className="font-semibold">{user.storesCreated}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty */}
        {data.length === 0 && (
          <div className="p-5 text-center text-gray-400">
            No leaderboard data
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
