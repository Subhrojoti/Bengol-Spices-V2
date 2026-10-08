import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import {
  BadgeCheck,
  Box,
  ImagePlus,
  Info,
  Loader2,
  Package,
  RotateCcw,
  Tag,
  X,
} from "lucide-react";
import {
  Editor,
  EditorProvider,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnBulletList,
  BtnNumberedList,
  BtnUndo,
  BtnRedo,
  BtnLink,
  BtnClearFormatting,
} from "react-simple-wysiwyg";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import { updateProduct } from "../../../../api/services";
import { UOM_OPTIONS } from "../../../../utils/uom";
import { sanitizeHtml } from "../../../../utils/sanitizeHtml";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

/* Matches what the Product schema marks required. */
const REQUIRED = [
  ["name", "Product name"],
  ["title", "Title"],
  ["category", "Category"],
  ["sku", "SKU"],
  ["uom", "Unit of measure"],
  ["price", "Price"],
  ["stock", "Stock"],
];

const n = (v) => Number(v || 0);

const Section = ({ title, subtitle, icon, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-tight text-slate-900">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
    {children}
  </section>
);

const Field = ({ label, required, hint, error, children }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-[13.5px] font-semibold text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {hint && <span className="text-[12px] text-slate-400">{hint}</span>}
    </div>
    {children}
    {error && <p className="mt-1 text-[12.5px] text-rose-600">{error}</p>}
  </div>
);

const inputClass = (invalid) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 ${
    invalid
      ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
      : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
  }`;

/* One object URL per file, released when it changes. The old modal called
   createObjectURL inline during render, minting a new URL every pass. */
const useObjectUrl = (file) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
};

const ImageSlot = ({ label, existing, file, onSelect, onClear }) => {
  const preview = useObjectUrl(file);

  const handle = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Product images must be JPG or PNG");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    onSelect(selected);
  };

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 p-3.5 transition hover:border-blue-400 hover:bg-blue-50/40">
      <EntityAvatar
        src={preview || existing}
        fallback={<ImagePlus size={20} />}
        className="h-20 w-20 rounded-xl"
        imgClassName="bg-white object-contain"
      />

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-slate-800">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">
          {file ? file.name : existing ? "Current image" : "No image"}
        </span>
        <span className="block text-[12px] text-slate-400">
          {file ? "Will replace the current image" : "Click to replace · JPG or PNG, up to 5 MB"}
        </span>
      </span>

      {file && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClear();
          }}
          title="Keep the current image"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
          <X size={16} />
        </button>
      )}

      <input type="file" accept="image/jpeg,image/png" hidden onChange={handle} />
    </label>
  );
};

/* ------------------------------------------------------------------ */

const EditProductDetails = ({ product, onClose, onSuccess }) => {
  const initial = useMemo(
    () => ({
      name: product?.name || "",
      title: product?.title || "",
      /* The editor puts this straight onto the page as HTML, so it is
         cleaned first (utils/sanitizeHtml.js) */
      description: sanitizeHtml(product?.description || ""),
      category: product?.category || "",
      sku: product?.sku || "",
      uom: product?.uom || "",
      price: product?.price ?? "",
      discountPrice: product?.discountPrice ?? "",
      gstPercentage: product?.gstPercentage ?? "",
      stock: product?.stock ?? "",
      minOrderQty: product?.minOrderQty ?? "",
      retailerPrice: product?.retailerPrice ?? "",
      wholesalerPrice: product?.wholesalerPrice ?? "",
      distributorPrice: product?.distributorPrice ?? "",
    }),
    [product],
  );

  const [form, setForm] = useState(initial);
  const [certificates, setCertificates] = useState(product?.certificates || []);
  const [certDraft, setCertDraft] = useState("");
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setForm(initial);
    setCertificates(product?.certificates || []);
    setFrontImage(null);
    setBackImage(null);
    setTouched(false);
  }, [initial, product]);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const errors = useMemo(() => {
    const found = {};

    REQUIRED.forEach(([key, label]) => {
      if (String(form[key] ?? "").trim() === "")
        found[key] = `${label} is required`;
    });

    if (form.price !== "" && n(form.price) < 0)
      found.price = "Price cannot be negative";
    if (form.stock !== "" && n(form.stock) < 0)
      found.stock = "Stock cannot be negative";

    if (
      form.discountPrice !== "" &&
      form.price !== "" &&
      n(form.discountPrice) > n(form.price)
    ) {
      found.discountPrice = "Discount price cannot exceed the price";
    }

    if (
      form.gstPercentage !== "" &&
      (n(form.gstPercentage) < 0 || n(form.gstPercentage) > 100)
    ) {
      found.gstPercentage = "GST must be between 0 and 100";
    }

    if (form.minOrderQty !== "" && n(form.minOrderQty) < 1) {
      found.minOrderQty = "Minimum order quantity must be at least 1";
    }

    return found;
  }, [form]);

  const show = (key) => (touched ? errors[key] : undefined);

  /* Lets the footer say whether there is anything worth saving */
  const dirty = useMemo(() => {
    const changedFields = Object.keys(initial).some(
      (key) => String(form[key] ?? "") !== String(initial[key] ?? ""),
    );

    const changedCerts =
      JSON.stringify(certificates) !==
      JSON.stringify(product?.certificates || []);

    return changedFields || changedCerts || Boolean(frontImage || backImage);
  }, [form, initial, certificates, product, frontImage, backImage]);

  const addCertificate = (raw) => {
    const value = String(raw || "").trim();
    if (!value || certificates.includes(value)) return;
    setCertificates((prev) => [...prev, value]);
  };

  const onCertKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCertificate(certDraft);
      setCertDraft("");
      return;
    }
    if (e.key === "Backspace" && !certDraft && certificates.length) {
      setCertificates((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (Object.keys(errors).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    const data = new FormData();

    /* Only what was changed. Sending every field wrote back the stock shown
       when this form opened, undoing any orders placed in the meantime. A
       changed stock goes with the value it was changed from, and the server
       applies the difference to the current stock. */
    Object.entries(form).forEach(([key, value]) => {
      const next = String(value ?? "").trim();
      if (next === String(initial[key] ?? "").trim()) return;

      data.append(key, next);
      if (key === "stock") {
        data.append("previousStock", String(initial.stock ?? "").trim());
      }
    });

    data.append("certificates", certificates.join(","));

    if (frontImage) data.append("frontImage", frontImage);
    if (backImage) data.append("backImage", backImage);

    try {
      setLoading(true);
      await updateProduct(product._id, data);

      toast.success(`${form.name.trim()} updated`);
      onSuccess?.();
      onClose();
    } catch (error) {
      /* The API returns useful messages, including a duplicate SKU. The old
         modal replaced all of them with one generic string. */
      toast.error(
        error?.response?.data?.message || "Could not update this product",
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm(initial);
    setCertificates(product?.certificates || []);
    setCertDraft("");
    setFrontImage(null);
    setBackImage(null);
    setTouched(false);
  };

  return (
    <Dialog
      open
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            // the page colour of whichever theme is showing
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? theme.palette.background.default : "#f8fafc",
          },
        },
      }}>
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[88vh] flex-col">
        {/* HEADER */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <EntityAvatar
            src={product?.images?.front?.url}
            fallback={<Package size={18} />}
            className="h-11 w-11 rounded-xl"
            imgClassName="bg-white object-contain"
          />

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold leading-tight text-slate-900">
              Edit product
            </h2>
            <p className="truncate text-[13px] text-slate-500">
              {product?.name}
              {product?.sku && (
                <span className="ml-1.5 font-mono text-[12.5px] text-slate-400">
                  {product.sku}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        {/* BODY */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <Section
            title="Basic Information"
            subtitle="How the product is named and described."
            icon={<Package size={17} />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Product Name" required error={show("name")}>
                <input
                  value={form.name}
                  onChange={set("name")}
                  className={inputClass(show("name"))}
                />
              </Field>

              <Field label="Title" required error={show("title")}>
                <input
                  value={form.title}
                  onChange={set("title")}
                  className={inputClass(show("title"))}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Description" hint="optional">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                  <EditorProvider>
                    <Toolbar className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
                      <BtnBold />
                      <BtnItalic />
                      <BtnUnderline />
                      <BtnBulletList />
                      <BtnNumberedList />
                      <BtnLink />
                      <BtnUndo />
                      <BtnRedo />
                      <BtnClearFormatting />
                    </Toolbar>

                    <Editor
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      containerProps={{
                        className:
                          "min-h-[140px] p-4 text-[14px] text-slate-700 border-0 outline-none",
                      }}
                    />
                  </EditorProvider>
                </div>
              </Field>
            </div>
          </Section>

          <Section
            title="Classification"
            subtitle="How it is grouped and identified."
            icon={<Tag size={17} />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Category" required error={show("category")}>
                <input
                  value={form.category}
                  onChange={set("category")}
                  className={inputClass(show("category"))}
                />
              </Field>

              <Field label="SKU" required error={show("sku")} hint="must be unique">
                <input
                  value={form.sku}
                  onChange={set("sku")}
                  className={`${inputClass(show("sku"))} font-mono`}
                />
              </Field>

              <Field
                label="Unit of Measure"
                required
                error={show("uom")}
                hint={form.uom === "packet" ? "prices are per packet" : undefined}>
                <select
                  value={form.uom}
                  onChange={set("uom")}
                  className={inputClass(show("uom"))}>
                  <option value="">Select</option>
                  {UOM_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  {/* A product saved long ago with a unit no longer offered
                      keeps it until another one is chosen */}
                  {form.uom && !UOM_OPTIONS.some((u) => u.value === form.uom) && (
                    <option value={form.uom}>{form.uom}</option>
                  )}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            title="Pricing & Inventory"
            subtitle="Base price, tax and what is in stock."
            icon={<Box size={17} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Price" required error={show("price")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={set("price")}
                  className={inputClass(show("price"))}
                />
              </Field>

              <Field label="Discount Price" hint="optional" error={show("discountPrice")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountPrice}
                  onChange={set("discountPrice")}
                  className={inputClass(show("discountPrice"))}
                />
              </Field>

              <Field label="GST %" error={show("gstPercentage")}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.gstPercentage}
                  onChange={set("gstPercentage")}
                  className={inputClass(show("gstPercentage"))}
                />
              </Field>

              <Field label="Stock" required error={show("stock")}>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={set("stock")}
                  className={inputClass(show("stock"))}
                />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Min Order Qty" error={show("minOrderQty")}>
                <input
                  type="number"
                  min="1"
                  value={form.minOrderQty}
                  onChange={set("minOrderQty")}
                  className={inputClass(show("minOrderQty"))}
                />
              </Field>

              <Field label="Certificates" hint="optional">
                <div className="rounded-xl border border-slate-200 bg-white p-2 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {certificates.map((cert) => (
                      <span
                        key={cert}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 py-1 pl-2.5 pr-1 text-[13px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <BadgeCheck size={12} />
                        {cert}
                        <button
                          type="button"
                          onClick={() =>
                            setCertificates((prev) =>
                              prev.filter((c) => c !== cert),
                            )
                          }
                          aria-label={`Remove ${cert}`}
                          className="rounded p-0.5 text-emerald-500 transition hover:bg-emerald-100">
                          <X size={12} />
                        </button>
                      </span>
                    ))}

                    <input
                      value={certDraft}
                      onChange={(e) => setCertDraft(e.target.value)}
                      onKeyDown={onCertKeyDown}
                      onBlur={() => {
                        if (certDraft) {
                          addCertificate(certDraft);
                          setCertDraft("");
                        }
                      }}
                      placeholder={certificates.length ? "Add another" : "FSSAI, ISO…"}
                      className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </Field>
            </div>
          </Section>

          <Section
            title="Role-Based Pricing"
            subtitle="Per store type. Clear a field to fall back to the standard price."
            icon={<Tag size={17} />}>
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-[13px] leading-relaxed text-blue-800">
                A tier left empty charges the standard price at order time. Only
                fill in the ones that genuinely differ.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ["retailerPrice", "Retailer Price"],
                ["wholesalerPrice", "Wholesaler Price"],
                ["distributorPrice", "Distributor Price"],
              ].map(([key, label]) => (
                <Field key={key} label={label} hint="optional">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[key]}
                    onChange={set(key)}
                    placeholder="—"
                    className={inputClass(false)}
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section
            title="Product Images"
            subtitle="Leave a slot untouched to keep the current image."
            icon={<ImagePlus size={17} />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ImageSlot
                label="Front Image"
                existing={product?.images?.front?.url}
                file={frontImage}
                onSelect={setFrontImage}
                onClear={() => setFrontImage(null)}
              />
              <ImageSlot
                label="Back Image"
                existing={product?.images?.back?.url}
                file={backImage}
                onSelect={setBackImage}
                onClear={() => setBackImage(null)}
              />
            </div>
          </Section>
        </div>

        {/* FOOTER */}
        <footer className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <p className="text-[12.5px] text-slate-400">
            {dirty ? "Unsaved changes" : "No changes yet"}
          </p>

          <div className="ml-auto flex gap-2.5">
            <button
              type="button"
              onClick={reset}
              disabled={loading || !dirty}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              <RotateCcw size={14} />
              Revert
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
};

export default EditProductDetails;
