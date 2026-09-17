import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, MapPin, Search, Undo2 } from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import { getMyDeliveryHistory } from "../../../../api/services";
import { Card, Empty, ListSkeleton, LoadError, Stat } from "../../ui";
import { day, inr } from "../../format";

/* When it was actually delivered or completed: the dedicated delivery time
   where there is one, else the matching status entry, else the last update. */
const completedAt = (record, finalStatus) =>
  record.delivery?.deliveredAt ||
  [...(record.statusHistory || [])]
    .reverse()
    .find((entry) => entry.status === finalStatus)?.changedAt ||
  record.updatedAt;

/**
 * Everything the partner has delivered and every return they completed.
 * The server has always offered this history; the panel never showed it.
 */
export default function DeliveryHistory() {
  const [tab, setTab] = useState("delivered");
  const [data, setData] = useState({
    deliveredOrders: [],
    completedReturns: [],
  });
  const [status, setStatus] = useState("loading");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await getMyDeliveryHistory();
      if (!response?.success) throw new Error("No history");
      setData({
        deliveredOrders: response?.data?.deliveredOrders || [],
        completedReturns: response?.data?.completedReturns || [],
      });
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load delivery history", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list =
      tab === "delivered"
        ? data.deliveredOrders.map((order) => ({
            key: order._id,
            id: order.orderId,
            status: order.status,
            store: order.deliveryAddress?.storeName || order.store?.storeName,
            place: [order.deliveryAddress?.city, order.deliveryAddress?.state]
              .filter(Boolean)
              .join(", "),
            amount: order.totalAmount,
            items: order.products?.length || 0,
            when: completedAt(order, "DELIVERED"),
          }))
        : data.completedReturns.map((ret) => ({
            key: ret._id,
            id: ret.returnId,
            status: ret.status,
            store: ret.orderId ? `Order ${ret.orderId}` : "",
            place: "",
            note: ret.reason,
            amount: null,
            items: null,
            when: completedAt(ret, "COMPLETED"),
          }));

    const term = search.trim().toLowerCase();
    const filtered = term
      ? list.filter((row) =>
          [row.id, row.store, row.place, row.note]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(term)),
        )
      : list;

    return filtered.sort((a, b) => new Date(b.when) - new Date(a.when));
  }, [data, tab, search]);

  if (status === "error") {
    return <LoadError title="Could not load your history" onRetry={load} />;
  }

  const thisMonth = data.deliveredOrders.filter((order) => {
    const when = new Date(completedAt(order, "DELIVERED"));
    const now = new Date();
    return (
      when.getMonth() === now.getMonth() &&
      when.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat
          label="Orders delivered"
          value={status === "loading" ? "—" : data.deliveredOrders.length}
          icon={<CheckCircle2 size={17} />}
          tint="#e6f4f2"
          ink="#0f766e"
        />
        <Stat
          label="Delivered this month"
          value={status === "loading" ? "—" : thisMonth}
          icon={<History size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Returns completed"
          value={status === "loading" ? "—" : data.completedReturns.length}
          icon={<Undo2 size={17} />}
          tint="#fdeee7"
          ink="#c2532a"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[
              { key: "delivered", label: "Delivered orders" },
              { key: "returns", label: "Completed returns" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-[14px] font-semibold transition ${
                  tab === t.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or store"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>

        {status === "loading" ? (
          <ListSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <Empty
            icon={<History size={24} />}
            title={search ? "Nothing matches your search" : "Nothing here yet"}
            hint={
              search
                ? "Try a different ID or store name."
                : tab === "delivered"
                  ? "Orders you deliver will be listed here."
                  : "Returns you complete will be listed here."
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[14px] font-semibold text-slate-900">
                      {row.id}
                    </p>
                    <StatusPill status={row.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[14px] text-slate-600">
                    {row.store || "—"}
                  </p>
                  {row.note && (
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-400">
                      {row.note}
                    </p>
                  )}
                  {row.place && (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-slate-400">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{row.place}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {row.amount != null && (
                    <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                      {inr(row.amount)}
                    </p>
                  )}
                  <p className="text-[12.5px] tabular-nums text-slate-500">
                    {day(row.when)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
