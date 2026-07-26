import React, { useEffect, useMemo, useState } from "react";
import { getAllReturns } from "../../../../api/services";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FilterListIcon from "@mui/icons-material/FilterList";
import StoreIcon from "@mui/icons-material/Store";

const ReturnsManagement = () => {
  const [returns, setReturns] = useState([]);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [expandedReturn, setExpandedReturn] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await getAllReturns();
      setReturns(res.data || []);
    } catch (error) {
      console.error("Failed to fetch returns:", error);
    } finally {
      setLoading(false);
    }
  };

  // GROUP BY STORE
  const consumers = useMemo(() => {
    const grouped = {};

    returns.forEach((ret) => {
      if (!grouped[ret.consumerId]) {
        grouped[ret.consumerId] = {
          agentId: ret.agentId,
          returns: [],
        };
      }

      grouped[ret.consumerId].returns.push(ret);
    });

    return grouped;
  }, [returns]);

  const consumerKeys = Object.keys(consumers);
  const selectedReturns = useMemo(() => {
    if (!selectedConsumer) return [];

    const returnsList = consumers[selectedConsumer]?.returns || [];

    if (statusFilter === "ALL") return returnsList;

    return returnsList.filter((ret) => ret.status === statusFilter);
  }, [selectedConsumer, consumers, statusFilter]);

  const availableStatusOptions = useMemo(() => {
    if (!selectedConsumer) return [];

    const returnsList = consumers[selectedConsumer]?.returns || [];

    const uniqueStatuses = [...new Set(returnsList.map((ret) => ret.status))];

    return ["ALL", ...uniqueStatuses];
  }, [selectedConsumer, consumers]);

  const returnCountLabel = useMemo(() => {
    if (!selectedConsumer) return "";

    const returnsList = consumers[selectedConsumer]?.returns || [];

    if (statusFilter === "ALL") {
      return `${returnsList.length} Total`;
    }

    const count = returnsList.filter(
      (ret) => ret.status === statusFilter,
    ).length;

    return `${count} ${statusFilter.replaceAll("_", " ")}`;
  }, [selectedConsumer, consumers, statusFilter]);

  const toggleAccordion = (returnId) => {
    setExpandedReturn((prev) => (prev === returnId ? null : returnId));
  };

  const statusColors = {
    INITIATED: "bg-blue-400 text-white",
    PICKUP_ASSIGNED: "bg-purple-500 text-white",
    PICKED_UP: "bg-yellow-400 text-black",
    RECEIVED_AT_WAREHOUSE: "bg-orange-400 text-black",
    REFUND_PROCESSED: "bg-green-400 text-white",
    COMPLETED: "bg-green-600 text-white",
    CANCELLED: "bg-red-600 text-white",
  };

  return (
    <div className="min-h-screen p-8 bg-blue-50">
      <div className="flex gap-8 h-[calc(100vh-4rem)]">
        {/* LEFT PANEL */}
        <div className="w-1/3 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blue-100">
            <h2 className="text-xl font-semibold text-blue-800">Stores</h2>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {consumerKeys.map((consumerId) => (
              <div
                key={consumerId}
                onClick={() => {
                  setSelectedConsumer(consumerId);
                  setExpandedReturn(null);
                }}
                className={`p-4 rounded-xl cursor-pointer border transition flex gap-4 items-start
    ${
      selectedConsumer === consumerId
        ? "bg-blue-100 border-blue-500 border-2"
        : "bg-blue-50 hover:bg-blue-100 border-blue-200"
    }`}>
                {/* LEFT ICON */}
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <StoreIcon className="text-blue-600 text-3xl" />
                </div>

                {/* RIGHT CONTENT */}
                <div className="flex flex-col">
                  <p className="font-semibold">Store ID: {consumerId}</p>

                  <p className="text-sm opacity-80">
                    Registered By: {consumers[consumerId].agentId}
                  </p>

                  <p className="text-sm font-semibold">
                    Total Returns: {consumers[consumerId].returns.length}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-2/3 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blue-100 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-blue-800 flex items-center gap-2">
              Returns
              {selectedConsumer && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                  {returnCountLabel}
                </span>
              )}
            </h2>

            {selectedConsumer && (
              <div className="flex items-center gap-3">
                {statusFilter !== "ALL" && (
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className="px-3 text-xs bg-gray-200 hover:bg-gray-300 rounded-md">
                    Clear Filter
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowFilterMenu((prev) => !prev)}
                    className="p-2 rounded-full hover:bg-blue-100 transition">
                    <FilterListIcon className="text-blue-700" />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
                      {availableStatusOptions.map((status) => (
                        <div
                          key={status}
                          onClick={() => {
                            setStatusFilter(status);
                            setShowFilterMenu(false);
                          }}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                            statusFilter === status
                              ? "bg-blue-100 font-semibold"
                              : ""
                          }`}>
                          {status.replaceAll("_", " ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {!selectedConsumer && (
              <p className="text-gray-400">Select a store to view returns.</p>
            )}

            {selectedReturns?.map((ret) => {
              const isOpen = expandedReturn === ret._id;

              return (
                <div
                  key={ret._id}
                  className="border border-blue-200 rounded-xl overflow-hidden">
                  {/* HEADER */}
                  <div
                    onClick={() => toggleAccordion(ret._id)}
                    className="p-4 cursor-pointer flex justify-between items-center bg-blue-50 hover:bg-blue-100 transition">
                    <div>
                      <p className="font-semibold text-blue-700">
                        {ret.returnId}
                      </p>

                      <p className="text-sm text-gray-600">
                        Order: {ret.orderId}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-bold ${
                          statusColors[ret.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}>
                        {ret.status.replaceAll("_", " ")}
                      </span>

                      <span className="text-blue-600 text-lg">
                        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </span>
                    </div>
                  </div>

                  {/* BODY */}
                  {isOpen && (
                    <div className="p-5 bg-white space-y-4 border-t border-blue-100">
                      {/* DETAILS */}
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Store ID: {ret.consumerId}</p>
                        <p>Agent ID: {ret.agentId}</p>
                        <p>Reason: {ret.reason}</p>

                        <p>Initiated By: {ret.initiatedBy?.name}</p>

                        {ret.pickup?.partnerId && (
                          <p>Pickup Partner: {ret.pickup.partnerId.name}</p>
                        )}

                        <p>
                          Initiated At:{" "}
                          {new Date(ret.initiatedAt).toLocaleString()}
                        </p>
                      </div>

                      {/* STATUS HISTORY */}
                      {ret.statusHistory?.length > 0 &&
                        (() => {
                          const latest =
                            ret.statusHistory[ret.statusHistory.length - 1];

                          const isHistoryOpen = expandedHistory === ret._id;

                          return (
                            <div className="mt-4">
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-sm text-gray-600 font-bold whitespace-nowrap">
                                  Track Status Updates:
                                </span>

                                <div
                                  onClick={() =>
                                    setExpandedHistory((prev) =>
                                      prev === ret._id ? null : ret._id,
                                    )
                                  }
                                  className="flex-1 cursor-pointer bg-gray-100 hover:bg-gray-200 transition rounded-3xl px-4 py-3 flex justify-between items-center">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-700">
                                      {latest.status.replaceAll("_", " ")}
                                    </span>

                                    <span className="text-xs text-gray-400">
                                      •{" "}
                                      {new Date(
                                        latest.changedAt,
                                      ).toLocaleString()}
                                    </span>
                                  </div>

                                  <span className="text-gray-400">
                                    {isHistoryOpen ? (
                                      <ExpandLessIcon fontSize="small" />
                                    ) : (
                                      <ExpandMoreIcon fontSize="small" />
                                    )}
                                  </span>
                                </div>
                              </div>

                              {isHistoryOpen && (
                                <div className="mt-4 ml-[160px] space-y-3 px-2">
                                  {ret.statusHistory.map((history, index) => (
                                    <div
                                      key={history._id}
                                      className="flex items-start gap-3 text-sm text-gray-600">
                                      <div className="flex flex-col items-center mt-1">
                                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>

                                        {index !==
                                          ret.statusHistory.length - 1 && (
                                          <div className="w-px h-6 bg-gray-300 mt-1"></div>
                                        )}
                                      </div>

                                      <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-semibold text-gray-700">
                                            {history.status.replaceAll(
                                              "_",
                                              " ",
                                            )}
                                          </span>

                                          <span className="text-xs text-gray-400">
                                            {new Date(
                                              history.changedAt,
                                            ).toLocaleString()}
                                          </span>
                                        </div>

                                        <p className="text-xs text-gray-400 mt-1">
                                          By:{" "}
                                          {history.changedBy?.role || "System"}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnsManagement;
