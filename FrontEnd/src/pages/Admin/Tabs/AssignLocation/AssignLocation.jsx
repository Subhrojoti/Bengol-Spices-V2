import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Autocomplete, TextField } from "@mui/material";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  IndianRupee,
  Loader2,
  MapPin,
  Map,
  Plus,
  RefreshCcw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import Pagination from "../../../../components/common/Pagination";
import usePagination from "../../../../hooks/usePagination";
import {
  assignLocation,
  agentList,
  fetchProducts,
  getSalesLocations,
} from "../../../../api/services";

const PINCODE_RE = /^\d{6}$/;

/* The four store types a product is priced for, in the order shown */
const TIERS = [
  ["retailerPrice", "Retailer"],
  ["wholesalerPrice", "Wholesaler"],
  ["distributorPrice", "Distributor"],
  ["horecaPrice", "HoReCa"],
];

const EMPTY_ROW = {
  retailerPrice: "",
  wholesalerPrice: "",
  distributorPrice: "",
  horecaPrice: "",
};

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, icon, tint, ink }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <span
        className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ "--tint": tint, "--ink": ink }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-slate-400">{label}</p>
      </div>
    </div>
  </Card>
);

const Label = ({ children, hint }) => (
  <div className="mb-1.5 flex items-baseline justify-between gap-2">
    <label className="text-[13.5px] font-semibold text-slate-700">{children}</label>
    {hint && <span className="text-[12.5px] text-slate-400">{hint}</span>}
  </div>
);

/* MUI inputs styled to match the plain Tailwind fields used elsewhere */
const fieldSx = (theme) => {
  const dark = theme.palette.mode === "dark";

  return {
    "& .MuiOutlinedInput-root": {
      borderRadius: "0.6rem",
      backgroundColor: dark ? theme.palette.background.paper : "#fff",
      fontSize: "13.5px",
      "& fieldset": { borderColor: dark ? "#2a3649" : "#e2e8f0" },
      "&:hover fieldset": { borderColor: dark ? "#3b4a61" : "#cbd5e1" },
      "&.Mui-focused fieldset": { borderColor: "#60a5fa", borderWidth: "2px" },
    },
  };
};

export default function AssignLocation() {
  const [agents, setAgents] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [suggested, setSuggested] = useState([]);

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingPins, setLoadingPins] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [agent, setAgent] = useState(null);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pincodes, setPincodes] = useState([]);
  const [draft, setDraft] = useState("");

  /* Location prices for this territory: productId → tier values as typed.
     Blank means the product's default price applies. */
  const [catalog, setCatalog] = useState([]);
  const [prices, setPrices] = useState({});
  const [pricingOpen, setPricingOpen] = useState(false);

  /* Guards against a slow reply for an earlier state/city overwriting a
     newer one — the old code fired these with no ordering at all. */
  const cityReq = useRef(0);
  const pinReq = useRef(0);

  const loadBase = useCallback(async () => {
    setLoadingBase(true);
    try {
      const [agentRes, coverRes, productRes] = await Promise.all([
        agentList(),
        getSalesLocations(),
        fetchProducts(),
      ]);
      setAgents(agentRes?.agents || []);
      setCoverage(coverRes?.locations || []);
      setCatalog(productRes?.products || []);
    } catch (error) {
      console.error("Failed to load agents or coverage", error);
      toast.error("Could not load agents and existing coverage");
    } finally {
      setLoadingBase(false);
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await axios.post(
          "https://countriesnow.space/api/v0.1/countries/states",
          { country: "India" },
        );
        setStates((res.data?.data?.states || []).map((s) => s.name));
      } catch {
        toast.error("Could not load the state list");
      }
    };
    fetchStates();
  }, []);

  const fetchCities = useCallback(async (stateName) => {
    if (!stateName) return;

    const id = ++cityReq.current;
    setLoadingCities(true);

    try {
      const res = await axios.post(
        "https://countriesnow.space/api/v0.1/countries/state/cities",
        { country: "India", state: stateName },
      );
      if (id === cityReq.current) setCities(res.data?.data || []);
    } catch {
      if (id === cityReq.current) {
        setCities([]);
        toast.error("Could not load cities for that state");
      }
    } finally {
      if (id === cityReq.current) setLoadingCities(false);
    }
  }, []);

  const fetchSuggestedPins = useCallback(async (cityName, stateName) => {
    if (!cityName || !stateName) {
      setSuggested([]);
      return;
    }

    const id = ++pinReq.current;
    setLoadingPins(true);

    try {
      const res = await axios.get(
        `https://api.postalpincode.in/postoffice/${encodeURIComponent(cityName)}`,
      );
      const data = res.data?.[0];

      const pins =
        data?.Status === "Success"
          ? [
              ...new Set(
                (data.PostOffice || [])
                  .filter(
                    (po) =>
                      String(po.State).toLowerCase() ===
                      String(stateName).toLowerCase(),
                  )
                  .map((po) => po.Pincode),
              ),
            ].sort()
          : [];

      if (id === pinReq.current) setSuggested(pins);
    } catch {
      if (id === pinReq.current) setSuggested([]);
    } finally {
      if (id === pinReq.current) setLoadingPins(false);
    }
  }, []);

  /* Existing record for this agent + state. Saving replaces it, so it is
     pre-loaded into the editor rather than silently wiped. */
  const existing = useMemo(() => {
    if (!agent || !state) return null;
    return (
      coverage.find(
        (c) =>
          c.agentId === agent.agentId &&
          String(c.state).toUpperCase() === state.toUpperCase(),
      ) || null
    );
  }, [coverage, agent, state]);

  const agentCoverage = useMemo(
    () => (agent ? coverage.filter((c) => c.agentId === agent.agentId) : []),
    [coverage, agent],
  );

  // The list on the right: one agent's territories, or everyone's
  const [coveragePager, coveragePagerTop] = usePagination(agent ? agentCoverage : coverage, {
    resetKey: agent?.agentId || "",
  });

  const stats = useMemo(
    () => ({
      agents: new Set(coverage.map((c) => c.agentId)).size,
      states: new Set(coverage.map((c) => c.state)).size,
      pincodes: coverage.reduce((sum, c) => sum + (c.pincodes?.length || 0), 0),
    }),
    [coverage],
  );

  const selectAgent = async (value) => {
    setAgent(value);
    setPincodes([]);
    setSuggested([]);
    setCities([]);
    setCity("");
    setState("");

    if (!value) return;

    /* Seed from the agent's own address so the common case is one click */
    const rawState = value.addressDetails?.state || "";
    const matched = states.find(
      (s) => s.toLowerCase() === String(rawState).toLowerCase(),
    );

    if (matched) {
      setState(matched);
      await fetchCities(matched);

      const agentCity = value.addressDetails?.city || "";
      if (agentCity) {
        setCity(agentCity);
        fetchSuggestedPins(agentCity, matched);
      }
    }
  };

  /* Whenever the target changes, start from what is already assigned */
  useEffect(() => {
    setPincodes(existing?.pincodes ? [...existing.pincodes] : []);

    const seeded = {};
    (existing?.priceOverrides || []).forEach((row) => {
      seeded[String(row.productId)] = {
        retailerPrice: row.retailerPrice ?? "",
        wholesalerPrice: row.wholesalerPrice ?? "",
        distributorPrice: row.distributorPrice ?? "",
        horecaPrice: row.horecaPrice ?? "",
      };
    });
    setPrices(seeded);
    setPricingOpen(Object.keys(seeded).length > 0);
  }, [existing]);

  const setPrice = (productId, field, value) => {
    setPrices((prev) => ({
      ...prev,
      [productId]: { ...EMPTY_ROW, ...prev[productId], [field]: value },
    }));
  };

  /* What will be sent: only products with at least one price filled in */
  const priceOverrides = useMemo(
    () =>
      Object.entries(prices)
        .map(([productId, row]) => {
          const entry = { productId };
          let any = false;
          TIERS.forEach(([field]) => {
            const text = String(row[field] ?? "").trim();
            if (text !== "" && Number(text) > 0) {
              entry[field] = Number(text);
              any = true;
            }
          });
          return any ? entry : null;
        })
        .filter(Boolean),
    [prices],
  );

  const invalidPrice = useMemo(
    () =>
      Object.values(prices).some((row) =>
        TIERS.some(([field]) => {
          const text = String(row[field] ?? "").trim();
          return text !== "" && !(Number(text) > 0);
        }),
      ),
    [prices],
  );

  const addPincode = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return;

    if (!PINCODE_RE.test(value)) {
      toast.error("A pincode must be exactly 6 digits");
      return;
    }
    if (pincodes.includes(value)) return;

    setPincodes((prev) => [...prev, value]);
  };

  const onDraftKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addPincode(draft);
      setDraft("");
      return;
    }

    if (e.key === "Backspace" && !draft && pincodes.length) {
      setPincodes((prev) => prev.slice(0, -1));
    }
  };

  const canSubmit =
    Boolean(agent && state && pincodes.length) && !invalidPrice && !saving;

  const save = async () => {
    try {
      setSaving(true);

      await assignLocation({
        agentId: agent.agentId,
        pincodes,
        state,
        city,
        priceOverrides,
      });

      toast.success(
        `${pincodes.length} pincode${pincodes.length === 1 ? "" : "s"} assigned to ${agent.name}` +
          (priceOverrides.length
            ? ` with location prices for ${priceOverrides.length} product${priceOverrides.length === 1 ? "" : "s"}`
            : ""),
      );

      setConfirmOpen(false);

      const fresh = await getSalesLocations();
      setCoverage(fresh?.locations || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not assign the location",
      );
    } finally {
      setSaving(false);
    }
  };

  const unsuggested = suggested.filter((p) => !pincodes.includes(p));

  return (
    /* Matches the gutters the tabbed admin pages use. This page has no tab
       bar to carry them, so it sets its own. */
    <div className="min-h-screen space-y-4 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Agents with coverage"
          value={stats.agents}
          icon={<Users size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="States covered"
          value={stats.states}
          icon={<Map size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Pincodes assigned"
          value={stats.pincodes}
          icon={<MapPin size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== FORM ===== */}
        <Card className="lg:col-span-7">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
              Assign sales coverage
            </h2>
            <p className="mt-0.5 text-[13.5px] text-slate-500">
              Give an agent the pincodes they are allowed to register stores in.
            </p>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <Label hint={loadingBase ? "loading…" : `${agents.length} agents`}>
                Agent
              </Label>
              <Autocomplete
                options={agents}
                value={agent}
                onChange={(_, value) => selectAgent(value)}
                loading={loadingBase}
                getOptionLabel={(o) => `${o.name} (${o.agentId || "no id"})`}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <li key={key} {...rest}>
                      <div className="flex w-full items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-slate-800">
                            {option.name}
                          </p>
                          <p className="font-mono text-[12.5px] text-slate-500">
                            {option.agentId}
                          </p>
                        </div>
                        <StatusPill status={option.status} />
                      </div>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Search by name or ID" sx={fieldSx} />
                )}
              />

              {agent && agent.status !== "APPROVED" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-amber-700">
                  <AlertTriangle size={12} />
                  This agent is {String(agent.status).toLowerCase()} and cannot
                  sign in yet.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>State</Label>
                <Autocomplete
                  options={states}
                  value={state || null}
                  onChange={(_, value) => {
                    setState(value || "");
                    setCity("");
                    setCities([]);
                    setSuggested([]);
                    if (value) fetchCities(value);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Select state" sx={fieldSx} />
                  )}
                />
              </div>

              <div>
                <Label hint={loadingCities ? "loading…" : undefined}>City</Label>
                <Autocomplete
                  options={cities}
                  value={city || null}
                  disabled={!state || loadingCities}
                  onChange={(_, value) => {
                    setCity(value || "");
                    if (value) fetchSuggestedPins(value, state);
                    else setSuggested([]);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={state ? "Select city" : "Pick a state first"}
                      sx={fieldSx}
                    />
                  )}
                />
              </div>
            </div>

            {/* REPLACE WARNING — the API upserts on (agent, state) */}
            {existing && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-[13.5px] leading-relaxed text-amber-800">
                  {agent.name} already covers{" "}
                  <span className="font-semibold tabular-nums">
                    {existing.pincodes?.length || 0}
                  </span>{" "}
                  pincode{existing.pincodes?.length === 1 ? "" : "s"} in{" "}
                  {existing.state}. Saving replaces that whole list, so the
                  current ones are loaded below. Remove any that should go.
                </p>
              </div>
            )}

            {/* PINCODE EDITOR */}
            <div>
              <Label hint={`${pincodes.length} selected`}>Pincodes</Label>

              <div className="rounded-xl border border-slate-200 bg-white p-2 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  {pincodes.map((pin) => (
                    <span
                      key={pin}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 py-1 pl-2.5 pr-1 text-[13.5px] font-semibold tabular-nums text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {pin}
                      <button
                        type="button"
                        onClick={() =>
                          setPincodes((prev) => prev.filter((p) => p !== pin))
                        }
                        aria-label={`Remove ${pin}`}
                        className="rounded p-0.5 text-blue-400 transition hover:bg-blue-100 hover:text-blue-700">
                        <X size={12} />
                      </button>
                    </span>
                  ))}

                  <input
                    value={draft}
                    onChange={(e) =>
                      setDraft(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={onDraftKeyDown}
                    onBlur={() => {
                      if (draft) {
                        addPincode(draft);
                        setDraft("");
                      }
                    }}
                    inputMode="numeric"
                    placeholder={pincodes.length ? "Add another" : "Type a 6-digit pincode"}
                    className="min-w-[10rem] flex-1 bg-transparent px-1.5 py-1 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <p className="mt-1.5 text-[12.5px] text-slate-400">
                Press Enter, space or comma to add each one.
              </p>

              {/* SUGGESTIONS */}
              <div className="mt-3">
                {loadingPins ? (
                  <p className="flex items-center gap-1.5 text-[13px] text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    Looking up pincodes for {city}…
                  </p>
                ) : unsuggested.length > 0 ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
                        <Sparkles size={12} className="text-slate-400" />
                        Found in {city}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setPincodes((prev) => [...prev, ...unsuggested])
                        }
                        className="text-[12.5px] font-semibold text-blue-600 transition hover:text-blue-700">
                        Add all {unsuggested.length}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unsuggested.map((pin) => (
                        <button
                          key={pin}
                          type="button"
                          onClick={() => addPincode(pin)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] tabular-nums text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                          <Plus size={11} />
                          {pin}
                        </button>
                      ))}
                    </div>
                  </>
                ) : city && !loadingPins ? (
                  <p className="text-[13px] text-slate-400">
                    No further pincodes found for {city}. Type them in above.
                  </p>
                ) : null}
              </div>
            </div>

            {/* LOCATION PRICES — optional, per product and store type */}
            <div className="rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPricingOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <IndianRupee size={15} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-slate-800">
                      Location prices{" "}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </p>
                    <p className="text-[12.5px] text-slate-500">
                      {priceOverrides.length
                        ? `${priceOverrides.length} product${priceOverrides.length === 1 ? "" : "s"} priced for this territory`
                        : "Default prices apply unless you set one here"}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${pricingOpen ? "rotate-180" : ""}`}
                />
              </button>

              {pricingOpen && (
                <div className="border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                    <p className="text-[12.5px] text-slate-500">
                      Leave a box blank to keep the default. These prices apply
                      only to {agent ? `${agent.name}'s` : "this agent's"} stores
                      in {state || "this state"}.
                    </p>
                    {Object.keys(prices).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPrices({})}
                        className="text-[12.5px] font-semibold text-slate-500 transition hover:text-red-600">
                        Clear all
                      </button>
                    )}
                  </div>

                  {invalidPrice && (
                    <p className="mt-2 flex items-center gap-1.5 px-4 text-[13px] text-red-600">
                      <AlertTriangle size={12} />
                      A price must be a number above 0, or left blank.
                    </p>
                  )}

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2 font-bold">Product</th>
                          {TIERS.map(([field, label]) => (
                            <th key={field} className="px-3 py-2 font-bold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catalog.map((product) => {
                          const row = prices[product._id] || EMPTY_ROW;

                          return (
                            <tr
                              key={product._id}
                              className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2 align-middle">
                                <p className="font-medium text-slate-800">
                                  {product.name}
                                </p>
                                <p className="text-[12px] text-slate-400">
                                  per {product.uom}
                                </p>
                              </td>
                              {TIERS.map(([field]) => {
                                const text = String(row[field] ?? "");
                                const bad = text.trim() !== "" && !(Number(text) > 0);
                                const set = text.trim() !== "" && !bad;
                                const fallback = product[field];

                                return (
                                  <td key={field} className="px-3 py-2 align-middle">
                                    <div className="relative">
                                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
                                        ₹
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={text}
                                        onChange={(e) =>
                                          setPrice(product._id, field, e.target.value)
                                        }
                                        placeholder={
                                          fallback != null ? String(fallback) : "—"
                                        }
                                        className={`w-28 rounded-lg border py-1.5 pl-6 pr-2 text-[13px] tabular-nums outline-none transition placeholder:text-slate-300 ${
                                          bad
                                            ? "border-red-300 bg-red-50 text-red-700"
                                            : set
                                              ? "border-emerald-300 bg-emerald-50/50 text-emerald-800"
                                              : "border-slate-200 bg-white text-slate-800 focus:border-blue-400"
                                        }`}
                                      />
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                      {fallback != null
                                        ? `Default ₹${fallback}`
                                        : "No default set"}
                                    </p>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {!catalog.length && (
                    <p className="px-4 py-4 text-[13px] text-slate-400">
                      No active products to price.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              {!canSubmit && !saving && (
                <p className="text-[13px] text-slate-400">
                  {!agent
                    ? "Choose an agent"
                    : !state
                      ? "Choose a state"
                      : !pincodes.length
                        ? "Add at least one pincode"
                        : "Fix the highlighted price"}
                </p>
              )}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Saving…" : "Assign coverage"}
              </button>
            </div>
          </div>
        </Card>

        {/* ===== COVERAGE ===== */}
        <div className="lg:col-span-5">
          <Card className="lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                  {agent ? "Current coverage" : "All coverage"}
                </h2>
                <p className="mt-0.5 truncate text-[13.5px] text-slate-500">
                  {agent ? agent.name : `${coverage.length} assignments`}
                </p>
              </div>
              <button
                onClick={loadBase}
                disabled={loadingBase}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                <RefreshCcw size={13} className={loadingBase ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Tracks the viewport so tall screens show more of the list
                instead of capping it at a fixed height. */}
            <div
              ref={coveragePagerTop}
              className="scroll-mt-24 max-h-[28rem] overflow-y-auto p-4 lg:max-h-[calc(100vh-19rem)]">
              {(() => {
                const rows = agent ? agentCoverage : coverage;

                if (loadingBase) {
                  return (
                    <div className="animate-pulse space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-xl bg-slate-100" />
                      ))}
                    </div>
                  );
                }

                if (!rows.length) {
                  return (
                    <div className="py-10 text-center">
                      <MapPin size={24} className="mx-auto text-slate-300" />
                      <p className="mt-2.5 text-[14px] font-medium text-slate-700">
                        {agent ? "No coverage yet" : "Nothing assigned yet"}
                      </p>
                      <p className="mt-1 text-[13.5px] text-slate-400">
                        {agent
                          ? `${agent.name} has no territory assigned.`
                          : "Assign a first territory using the form."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {coveragePager.pageItems.map((row) => {
                      const isTarget =
                        existing && row._id === existing._id;

                      return (
                        <div
                          key={row._id}
                          className={`rounded-xl border p-3.5 transition ${
                            isTarget
                              ? "border-amber-300 bg-amber-50/60"
                              : "border-slate-200 bg-white"
                          }`}>
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-slate-900">
                                {row.state}
                                {row.city ? (
                                  <span className="font-normal text-slate-500">
                                    {" "}
                                    · {row.city}
                                  </span>
                                ) : null}
                              </p>
                              {!agent && (
                                <p className="font-mono text-[12.5px] text-slate-500">
                                  {row.agentId}
                                </p>
                              )}
                            </div>

                            {isTarget && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-amber-700">
                                Will be replaced
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {(row.pincodes || []).map((pin) => (
                              <span
                                key={pin}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[12.5px] tabular-nums text-slate-600">
                                {pin}
                              </span>
                            ))}
                          </div>

                          {row.priceOverrides?.length > 0 && (
                            <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-emerald-700">
                              <IndianRupee size={11} />
                              Location prices on {row.priceOverrides.length}{" "}
                              product{row.priceOverrides.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {!loadingBase && (
              <Pagination
                {...coveragePager.controls}
                compact
                label="assignments"
                className="border-t border-slate-100 px-4 py-3"
              />
            )}
          </Card>
        </div>
      </div>

      {/* ===== CONFIRM ===== */}
      <ConfirmDialog
        open={confirmOpen}
        busy={saving}
        tone={existing ? "warning" : "primary"}
        icon={existing ? <AlertTriangle size={18} /> : <Check size={18} />}
        title={existing ? "Replace this coverage?" : "Assign this coverage?"}
        description={
          existing
            ? `The pincodes currently assigned to ${agent?.name} in ${state} will be replaced by the list below.`
            : `${agent?.name} will be able to register stores in these pincodes.`
        }
        detail={
          agent && (
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Agent</span>
                <span className="truncate font-semibold text-slate-900">
                  {agent.name}{" "}
                  <span className="font-mono text-[13px] font-normal text-slate-500">
                    {agent.agentId}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Territory</span>
                <span className="font-medium text-slate-700">
                  {[city, state].filter(Boolean).join(", ")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Location prices</span>
                <span className="font-medium text-slate-700">
                  {priceOverrides.length
                    ? `${priceOverrides.length} product${priceOverrides.length === 1 ? "" : "s"}`
                    : "Defaults"}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    Pincodes{existing ? " (after saving)" : ""}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {pincodes.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pincodes.map((pin) => (
                    <span
                      key={pin}
                      className="rounded bg-white px-1.5 py-0.5 text-[12.5px] tabular-nums text-slate-600 ring-1 ring-slate-200">
                      {pin}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        }
        confirmLabel={saving ? "Saving…" : existing ? "Replace coverage" : "Assign coverage"}
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
