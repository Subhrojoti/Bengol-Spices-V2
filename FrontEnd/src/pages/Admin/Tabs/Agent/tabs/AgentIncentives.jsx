import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import { getIncentiveList, payoutIncentive } from "../../../../../api/services";

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, hint, icon, tint, ink }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[14px] font-medium text-slate-500">{label}</p>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint, color: ink }}>
        {icon}
      </span>
    </div>
    <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
      {value}
    </p>
    {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
  </Card>
);

const Skeleton = () => (
  <div className="animate-pulse space-y-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-64 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
  </div>
);

export default function AgentIncentives() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(null); // agent awaiting confirmation
  const [payingId, setPayingId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getIncentiveList();
      setData(Array.isArray(res?.data) ? res.data : []);
      setStatus("ready");
    } catch (err) {
      console.error("Error fetching incentives:", err);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      earned: data.reduce((s, a) => s + n(a.totalEarned), 0),
      paid: data.reduce((s, a) => s + n(a.totalPaid), 0),
      pending: data.reduce((s, a) => s + n(a.pending), 0),
      awaiting: data.filter((a) => n(a.pending) > 0).length,
    }),
    [data],
  );

  /* Runs only after the confirmation step. This used to fire straight from
     the card button, so one stray click paid an agent out. */
  const handlePayout = async () => {
    if (!confirming) return;

    const agent = confirming;

    try {
      setPayingId(agent.agentId);

      await payoutIncentive({
        agentId: agent.agentId,
        amount: n(agent.pending),
        note: "Incentive payout",
      });

      toast.success(`${inr(agent.pending)} paid to ${agent.name}`);
      setConfirming(null);
      await load(true);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Payout failed");
    } finally {
      setPayingId(null);
    }
  };

  if (status === "loading") return <Skeleton />;

  if (status === "error") {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load incentives
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Check your connection and try again.
        </p>
        <button
          onClick={() => load()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          <RefreshCcw size={14} />
          Retry
        </button>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card className="p-14 text-center">
        <Wallet size={26} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          No incentives yet
        </p>
        <p className="mt-1 text-[14px] text-slate-400">
          Agents appear here once they earn against a target.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Earned"
          value={inr(totals.earned)}
          hint={`across ${data.length} agent${data.length === 1 ? "" : "s"}`}
          icon={<Wallet size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Total Paid"
          value={inr(totals.paid)}
          hint="already settled"
          icon={<BadgeCheck size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Stat
          label="Pending Payout"
          value={inr(totals.pending)}
          hint="owed to agents"
          icon={<Clock3 size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="Awaiting Payment"
          value={totals.awaiting.toLocaleString("en-IN")}
          hint="agents with a balance"
          icon={<Banknote size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ===== AGENT CARDS ===== */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((agent) => {
          const earned = n(agent.totalEarned);
          const paid = n(agent.totalPaid);
          const pending = n(agent.pending);

          /* Clamped: a correction could otherwise push the bar past its track */
          const progress = earned
            ? Math.min(Math.max((paid / earned) * 100, 0), 100)
            : 0;

          const isPaying = payingId === agent.agentId;
          const settled = pending <= 0;

          return (
            <Card key={agent.agentId} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15.5px] font-semibold text-slate-900">
                    {agent.name}
                  </h3>
                  <p className="mt-0.5 font-mono text-[13px] tabular-nums text-slate-500">
                    {agent.agentId}
                  </p>
                </div>

                {agent.state && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[12.5px] font-medium text-slate-600">
                    <MapPin size={11} />
                    {agent.state}
                  </span>
                )}
              </div>

              {agent.phone && (
                <p className="mt-2 flex items-center gap-1.5 text-[13.5px] tabular-nums text-slate-500">
                  <Phone size={12} className="text-slate-400" />
                  {agent.phone}
                </p>
              )}

              <div className="my-4 border-t border-slate-100" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    Earned
                  </p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900">
                    {inr(earned)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    Paid
                  </p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-emerald-700">
                    {inr(paid)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    Pending
                  </p>
                  <p
                    className={`mt-1 text-[15px] font-semibold tabular-nums ${
                      settled ? "text-slate-400" : "text-amber-700"
                    }`}>
                    {inr(pending)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[12.5px] text-slate-400">
                  <span>Settled</span>
                  <span className="tabular-nums">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <button
                disabled={settled || isPaying}
                onClick={() => setConfirming(agent)}
                className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[14px] font-semibold transition ${
                  settled
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                }`}>
                {isPaying && <Loader2 size={14} className="animate-spin" />}
                {isPaying
                  ? "Processing…"
                  : settled
                    ? "Nothing pending"
                    : `Pay ${inr(pending)}`}
              </button>
            </Card>
          );
        })}
      </div>

      {/* ===== CONFIRMATION ===== */}
      <ConfirmDialog
        open={Boolean(confirming)}
        busy={Boolean(payingId)}
        tone="primary"
        icon={<Banknote size={19} />}
        title="Release this payout?"
        description="This records the payment against the agent's incentive ledger and cannot be undone here."
        detail={
          confirming && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] text-slate-500">Agent</span>
                <span className="truncate text-[14px] font-semibold text-slate-900">
                  {confirming.name}{" "}
                  <span className="font-mono text-[13px] font-normal text-slate-500">
                    {confirming.agentId}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-[13.5px] text-slate-500">Amount</span>
                <span className="text-[16px] font-bold tabular-nums text-slate-900">
                  {inr(confirming.pending)}
                </span>
              </div>
            </div>
          )
        }
        confirmLabel={payingId ? "Paying…" : "Confirm payout"}
        onConfirm={handlePayout}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
