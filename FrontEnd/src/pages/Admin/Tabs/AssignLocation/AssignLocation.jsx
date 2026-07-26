import { useEffect, useState } from "react";
import { assignLocation, agentList } from "../../../../api/services";
import { toast } from "react-toastify";
import {
  Button,
  MenuItem,
  Select,
  FormControl,
  TextField,
} from "@mui/material";
import axios from "axios";

export default function AssignLocation() {
  const [form, setForm] = useState({
    agentId: "",
    pincodes: "",
    state: "",
    city: "",
  });

  const [agents, setAgents] = useState([]);
  const [stateList, setStateList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [pincodeList, setPincodeList] = useState([]);

  // ------------------ AGENTS ------------------
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await agentList();
        setAgents(res.agents || []);
      } catch {
        toast.error("Failed to load agents");
      }
    };
    fetchAgents();
  }, []);

  // ------------------ FETCH STATES ------------------
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await axios.post(
          "https://countriesnow.space/api/v0.1/countries/states",
          { country: "India" },
        );

        setStateList(res.data.data.states || []);
      } catch {
        toast.error("Failed to load states");
      }
    };

    fetchStates();
  }, []);

  // ------------------ FETCH CITIES ------------------
  const fetchCities = async (state) => {
    try {
      const res = await axios.post(
        "https://countriesnow.space/api/v0.1/countries/state/cities",
        {
          country: "India",
          state,
        },
      );

      setCityList(res.data.data || []);
    } catch {
      toast.error("Failed to load cities");
    }
  };

  // ------------------ FETCH PINCODES ------------------
  const fetchPincodes = async (city, stateParam) => {
    if (!city || !stateParam) return;

    try {
      const res = await axios.get(
        `https://api.postalpincode.in/postoffice/${city}`,
      );

      const data = res.data?.[0];

      if (data?.Status === "Success") {
        const filtered = data.PostOffice.filter(
          (po) => po.State.toLowerCase() === stateParam.toLowerCase(),
        );

        const pins = [...new Set(filtered.map((po) => po.Pincode))];
        setPincodeList(pins);
      } else {
        setPincodeList([]);
      }
    } catch {
      toast.error("Failed to fetch pincodes");
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ------------------ PINCODE SELECT ------------------
  const handlePincodeSelect = (value) => {
    if (!value) return;

    setForm((prev) => {
      const existing = prev.pincodes
        ? prev.pincodes.split(",").map((p) => p.trim())
        : [];

      if (existing.includes(value)) return prev;

      return {
        ...prev,
        pincodes: [...existing, value].join(","),
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.agentId || !form.pincodes || !form.state || !form.city) {
      toast.error("Please fill all fields");
      return;
    }

    const payload = {
      agentId: form.agentId,
      pincodes: form.pincodes.split(",").map((p) => p.trim()),
      state: form.state,
      city: form.city,
    };

    try {
      await assignLocation(payload);
      toast.success("Location assigned successfully");

      setForm({
        agentId: "",
        pincodes: "",
        state: "",
        city: "",
      });
      setCityList([]);
      setPincodeList([]);
    } catch {
      toast.error("Failed to assign location");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* HEADER */}
      <div
        className="fixed top-0 left-[3%] right-0 z-10 bg-white border-b border-slate-200 px-8 flex items-center justify-between"
        style={{ height: 64 }}>
        <h1 className="text-base font-bold tracking-tight text-lg text-slate-800">
          Assign Location
        </h1>
      </div>

      <div className="max-w-4xl mx-auto">
        <div
          className="rounded-xl shadow-sm border border-gray-100 p-6 space-y-5"
          style={{
            background:
              "linear-gradient(140deg, rgba(222, 245, 255, 1), rgba(120, 208, 255, 0.68))",
          }}>
          <h2 className="text-lg font-medium text-gray-800">
            Assign location to agent
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* AGENT */}
            <div>
              <label className="text-xs font-medium">Select Agent</label>
              <FormControl
                fullWidth
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "0.5rem",

                    "& fieldset": {
                      borderColor: "#d1d5db",
                    },

                    "&:hover fieldset": {
                      borderColor: "#6366f1",
                    },

                    "&.Mui-focused fieldset": {
                      borderColor: "#6366f1",
                      borderWidth: "3px",
                    },
                  },
                }}>
                <Select
                  value={form.agentId}
                  onChange={async (e) => {
                    const selectedId = e.target.value;

                    handleChange("agentId", selectedId);

                    // find full agent object
                    const selectedAgent = agents.find(
                      (agent) => agent.agentId === selectedId,
                    );

                    const rawState = selectedAgent?.addressDetails?.state || "";

                    const state =
                      stateList.find(
                        (s) => s.name.toLowerCase() === rawState.toLowerCase(),
                      )?.name || "";
                    const city = selectedAgent?.addressDetails?.city || "";

                    // If state exists → set + fetch cities
                    if (state) {
                      handleChange("state", state);

                      await fetchCities(state); // wait so city list is ready
                    }

                    // If city exists → set + fetch pincodes
                    if (city) {
                      handleChange("city", city);

                      fetchPincodes(city, state);
                    }
                  }}
                  displayEmpty
                  className="bg-white">
                  <MenuItem value="" disabled>
                    Select Agent
                  </MenuItem>

                  {agents.map((agent) => (
                    <MenuItem key={agent._id} value={agent.agentId}>
                      {agent.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* STATE DROPDOWN */}
            <div>
              <label className="text-xs font-medium">State</label>
              <FormControl
                fullWidth
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "0.5rem",

                    "& fieldset": {
                      borderColor: "#d1d5db",
                    },

                    "&:hover fieldset": {
                      borderColor: "#6366f1",
                    },

                    "&.Mui-focused fieldset": {
                      borderColor: "#6366f1",
                      borderWidth: "3px",
                    },
                  },
                }}>
                <Select
                  value={form.state}
                  onChange={(e) => {
                    const value = e.target.value;

                    handleChange("state", value);
                    handleChange("city", "");
                    handleChange("pincodes", "");

                    setCityList([]);
                    setPincodeList([]);

                    fetchCities(value);
                  }}
                  displayEmpty
                  className="bg-white">
                  <MenuItem value="" disabled>
                    Select State
                  </MenuItem>

                  {stateList.map((state) => (
                    <MenuItem key={state.name} value={state.name}>
                      {state.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* CITY DROPDOWN */}
            <div>
              <label className="text-xs font-medium">City</label>
              <FormControl
                fullWidth
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "0.5rem",

                    "& fieldset": {
                      borderColor: "#d1d5db",
                    },

                    "&:hover fieldset": {
                      borderColor: "#6366f1",
                    },

                    "&.Mui-focused fieldset": {
                      borderColor: "#6366f1",
                      borderWidth: "3px",
                    },
                  },
                }}>
                <Select
                  value={form.city}
                  onChange={(e) => {
                    handleChange("city", e.target.value);
                    fetchPincodes(e.target.value, form.state);
                  }}
                  displayEmpty
                  className="bg-white">
                  <MenuItem value="" disabled>
                    Select City
                  </MenuItem>

                  {cityList.map((city) => (
                    <MenuItem key={city} value={city}>
                      {city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* PINCODES */}
            <div className="col-span-3">
              <label className="text-xs font-medium">Pincodes</label>

              <TextField
                fullWidth
                size="small"
                value={form.pincodes}
                onChange={(e) => handleChange("pincodes", e.target.value)}
                placeholder="Enter pincodes"
                sx={{
                  mb: 2,

                  "& .MuiOutlinedInput-root": {
                    borderRadius: "0.5rem",
                    backgroundColor: "#ffffff",
                    "& fieldset": {
                      borderColor: "#d1d5db",
                    },

                    "&:hover fieldset": {
                      borderColor: "#6366f1",
                    },

                    "&.Mui-focused fieldset": {
                      borderColor: "#6366f1",
                      borderWidth: "3px",
                    },
                  },
                }}
              />
              <FormControl
                fullWidth
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "0.5rem",

                    "& fieldset": {
                      borderColor: "#d1d5db",
                    },

                    "&:hover fieldset": {
                      borderColor: "#6366f1",
                    },

                    "&.Mui-focused fieldset": {
                      borderColor: "#6366f1",
                      borderWidth: "3px",
                    },
                  },
                }}>
                <Select
                  value=""
                  displayEmpty
                  onChange={(e) => handlePincodeSelect(e.target.value)}
                  className="bg-white">
                  <MenuItem value="" disabled>
                    Select Pincode
                  </MenuItem>

                  {pincodeList.map((pin) => (
                    <MenuItem key={pin} value={pin}>
                      {pin}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>

          {/* BUTTON */}
          <div className="flex justify-end pt-2">
            <Button
              variant="contained"
              onClick={handleSubmit}
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                fontSize: "1rem",
                fontWeight: 600,
                backgroundColor: "#0071bd",
                boxShadow: "0 4px 10px rgba(79, 70, 229, 0.3)",

                "&:hover": {
                  backgroundColor: "#00548c",
                  boxShadow: "0 6px 14px rgba(79, 70, 229, 0.4)",
                },

                "&:active": {
                  transform: "scale(0.97)",
                },
              }}>
              Assign Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
