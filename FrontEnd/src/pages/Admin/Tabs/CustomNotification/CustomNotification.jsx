import { useState } from "react";
import { sendNotification } from "../../../../api/services";
import { toast } from "react-toastify";
import { Button } from "@mui/material";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

export default function CustomNotification() {
  const [form, setForm] = useState({
    targetRole: "Agent",
    title: "",
    message: "",
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.message) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      await sendNotification(form);

      toast.success("Notification sent successfully");

      setForm({
        targetRole: "Agent",
        title: "",
        message: "",
      });
    } catch (err) {
      toast.error("Failed to send notification");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="fixed top-0 left-[3%] right-0 z-10 bg-white border-b border-slate-200 px-8 flex items-center justify-between"
        style={{ height: 64 }}>
        <h1 className="text-base font-bold tracking-tight text-lg text-slate-800">
          Create Custom Notification
        </h1>
      </div>
      <div className="max-w-3xl mx-auto">
        {/* ===== CARD ===== */}
        <div
          className="rounded-xl shadow-sm border border-gray-100 p-5 space-y-4"
          style={{
            background:
              "linear-gradient(140deg, rgba(222, 245, 255, 1), rgba(120, 208, 255, 0.68))",
          }}>
          {/* HEADER */}
          <div>
            <h2 className="text-lg font-medium text-gray-800">
              Send custom notifications
            </h2>
          </div>

          {/* FORM GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ROLE */}
            <div>
              <label className="text-xs text-gray-900 mb-1 block font-medium">
                Target Role
              </label>
              <FormControl fullWidth size="small">
                <Select
                  value={form.targetRole || ""}
                  displayEmpty
                  onChange={(e) => handleChange("targetRole", e.target.value)}
                  sx={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    "& .MuiSelect-select": {
                      padding: "10px 14px",
                    },
                  }}>
                  <MenuItem value="" disabled>
                    Select Target Role
                  </MenuItem>

                  <MenuItem value="Agent">Agent</MenuItem>
                  <MenuItem value="Employee">Employee</MenuItem>
                  <MenuItem value="DeliveryPartner">Delivery Partner</MenuItem>
                </Select>
              </FormControl>
            </div>

            {/* TITLE */}
            <div>
              <label className="text-xs text-gray-900 mb-1 block font-medium">
                Notification Title
              </label>
              <input
                type="text"
                placeholder="Enter notification title"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm 
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              />
            </div>

            {/* MESSAGE (FULL WIDTH) */}
            <div className="col-span-2">
              <label className="text-xs text-gray-900 mb-1 block font-medium">
                Message
              </label>
              <textarea
                rows={4}
                placeholder="Enter notification message..."
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white 
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* ACTION */}
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
              Send Notification
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
