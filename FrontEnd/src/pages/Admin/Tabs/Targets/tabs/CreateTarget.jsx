import { useState, useEffect } from "react";
import { createTarget, getAllProducts } from "../../../../../api/services";
import { toast } from "react-toastify";
import {
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from "@mui/material";

const emptyForm = {
  name: "",
  type: "STORE_CREATION",
  targetValue: "",
  rewardAmount: "",
  productCommissions: [],
  startDate: "",
  endDate: "",
};

export default function CreateTarget() {
  const [form, setForm] = useState(emptyForm);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // ── Fetch products on mount ───────────────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await getAllProducts();
        setProducts(data.products || []);
      } catch {
        toast.error("Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Product-commission helpers ────────────────────────────────────────────
  const addCommissionRule = () => {
    setForm((prev) => ({
      ...prev,
      productCommissions: [
        ...prev.productCommissions,
        { productId: "", commissionPerUnit: "" },
      ],
    }));
  };

  const updateCommissionRule = (index, key, value) => {
    setForm((prev) => {
      const updated = [...prev.productCommissions];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, productCommissions: updated };
    });
  };

  const removeCommissionRule = (index) => {
    setForm((prev) => ({
      ...prev,
      productCommissions: prev.productCommissions.filter((_, i) => i !== index),
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Target name is required");
    if (!form.startDate || !form.endDate)
      return toast.error("Start and end dates are required");
    if (!form.targetValue) return toast.error("Target value is required");
    if (!form.rewardAmount) return toast.error("Reward amount is required");

    if (form.type === "ORDER") {
      for (const rule of form.productCommissions) {
        if (!rule.productId || !rule.commissionPerUnit) {
          return toast.error(
            "Each product commission must have a product and commission per unit",
          );
        }
      }
    }

    try {
      const payload = {
        name: form.name,
        type: form.type,
        targetValue: Number(form.targetValue),
        rewardAmount: Number(form.rewardAmount),
        startDate: form.startDate,
        endDate: form.endDate,
        ...(form.type === "ORDER" && form.productCommissions.length > 0
          ? {
              productCommissions: form.productCommissions.map((r) => ({
                productId: r.productId,
                commissionPerUnit: Number(r.commissionPerUnit),
              })),
            }
          : {}),
      };

      await createTarget(payload);
      toast.success("Target created successfully");
      setForm(emptyForm);
    } catch {
      toast.error("Failed to create target");
    }
  };

  const isOrderType = form.type === "ORDER";

  // IDs already selected across all rules — to avoid duplicate product picks
  const selectedProductIds = form.productCommissions.map((r) => r.productId);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      <div
        className="rounded-xl shadow-sm border border-gray-100 p-5 space-y-4"
        style={{
          background:
            "linear-gradient(140deg, rgba(222, 245, 255, 1), rgba(120, 208, 255, 0.68))",
        }}>
        {/* HEADER */}
        <div>
          <h2 className="text-lg font-medium text-gray-800">
            Define target rules and incentives for agents
          </h2>
        </div>

        {/* FORM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NAME */}
          <div className="col-span-2">
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              Target Name
            </label>
            <input
              type="text"
              placeholder="e.g. Create 5 Stores"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            />
          </div>

          {/* TYPE */}
          <div className="col-span-2">
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              Target Type
            </label>
            <select
              value={form.type}
              onChange={(e) => {
                const newType = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  type: newType,
                  productCommissions:
                    newType !== "ORDER" ? [] : prev.productCommissions,
                }));
              }}
              className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none px-3 py-2 text-sm bg-white">
              <option value="STORE_CREATION">Store Creation</option>
              <option value="ORDER">Order Placement</option>
              <option value="PAYMENT">Collect Payment</option>
            </select>
          </div>

          {/* TARGET VALUE */}
          <div>
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              Target Value
            </label>
            <input
              type="number"
              placeholder="e.g. 10"
              value={form.targetValue}
              onChange={(e) => handleChange("targetValue", e.target.value)}
              className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* REWARD AMOUNT */}
          <div>
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              Reward Amount (₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 200"
              value={form.rewardAmount}
              onChange={(e) => handleChange("rewardAmount", e.target.value)}
              className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* START DATE */}
          <div>
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              Start Date
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => handleChange("startDate", e.target.value)}
              className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* END DATE */}
          <div>
            <label className="text-xs text-gray-900 mb-1 block font-medium">
              End Date
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => handleChange("endDate", e.target.value)}
              className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
        </div>

        {/* PRODUCT COMMISSIONS — ORDER type only */}
        {isOrderType && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-900 font-medium">
                Product Commissions{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <button
                type="button"
                onClick={addCommissionRule}
                disabled={productsLoading || products.length === 0}
                className="text-xs text-indigo-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
                + Add Product
              </button>
            </div>

            {/* Loading state */}
            {productsLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CircularProgress size={12} />
                <span>Loading products...</span>
              </div>
            )}

            {/* Empty state */}
            {!productsLoading && form.productCommissions.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                No product commissions yet. Click "+ Add Product" to add one.
              </p>
            )}

            {form.productCommissions.map((rule, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-3 bg-white/70 rounded-lg p-3 border border-gray-200">
                {/* Product Dropdown */}
                <div>
                  <label className="text-xs text-gray-700 mb-1 block">
                    Product
                  </label>
                  <select
                    value={rule.productId}
                    onChange={(e) =>
                      updateCommissionRule(index, "productId", e.target.value)
                    }
                    className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option
                        key={product._id}
                        value={product._id}
                        disabled={
                          selectedProductIds.includes(product._id) &&
                          rule.productId !== product._id
                        }>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Commission per unit */}
                <div>
                  <label className="text-xs text-gray-700 mb-1 block">
                    Commission / Unit (₹)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      value={rule.commissionPerUnit}
                      onChange={(e) =>
                        updateCommissionRule(
                          index,
                          "commissionPerUnit",
                          e.target.value,
                        )
                      }
                      className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeCommissionRule(index)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold px-1"
                      title="Remove rule">
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
            Create Target
          </Button>
        </div>
      </div>
    </div>
  );
}
