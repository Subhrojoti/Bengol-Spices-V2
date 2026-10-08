import { useCallback, useEffect, useMemo, useState } from "react";
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
import { createProduct, getAllProducts } from "../../../../api/services";
import { UOM_OPTIONS } from "../../../../utils/uom";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

/* Matches what the Product schema actually marks required. The old form had
   this inverted: it required the three optional tier prices and let category,
   SKU, price and stock through empty, so the server rejected the submission
   after both images had already uploaded. */
const REQUIRED = [
  ["name", "Product name"],
  ["title", "Title"],
  ["category", "Category"],
  ["sku", "SKU"],
  ["uom", "Unit of measure"],
  ["price", "Price"],
  ["stock", "Stock"],
];

const EMPTY = {
  name: "",
  title: "",
  description: "",
  category: "",
  sku: "",
  uom: "",
  price: "",
  discountPrice: "",
  gstPercentage: "",
  stock: "",
  minOrderQty: "",
  retailerPrice: "",
  wholesalerPrice: "",
  distributorPrice: "",
};

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Section = ({ title, subtitle, icon, children }) => (
  <Card className="p-5">
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
    {children}
  </Card>
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

/* One object URL per file, released when the file changes or unmounts. The
   old form called createObjectURL inline during render, minting a fresh URL
   on every pass and never revoking any of them. */
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

const ImageDrop = ({ label, file, preview, onSelect, onClear }) => {
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
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} className="text-slate-400" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-slate-800">
          {label} <span className="text-rose-500">*</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">
          {file ? file.name : "Click to upload"}
        </span>
        <span className="block text-[12px] text-slate-400">
          JPG or PNG, up to 5 MB
        </span>
      </span>

      {file && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClear();
          }}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
          <X size={16} />
        </button>
      )}

      <input type="file" accept="image/jpeg,image/png" hidden onChange={handle} />
    </label>
  );
};

/* ------------------------------------------------------------------ */

export default function ProductCreation() {
  const [form, setForm] = useState(EMPTY);
  const [certificates, setCertificates] = useState([]);
  const [certDraft, setCertDraft] = useState("");
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const frontPreview = useObjectUrl(frontImage);
  const backPreview = useObjectUrl(backImage);

  /* Existing categories power the suggestion list, so the catalog does not
     drift into "Spices", "spices" and "Spice". */
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await getAllProducts();
        const list = [
          ...new Set((res?.products || []).map((p) => p.category).filter(Boolean)),
        ].sort();
        setCategories(list);
      } catch {
        /* Suggestions are a convenience; the field still accepts free text */
      }
    };
    loadCategories();
  }, []);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const errors = useMemo(() => {
    const found = {};

    REQUIRED.forEach(([key, label]) => {
      if (!String(form[key]).trim()) found[key] = `${label} is required`;
    });

    if (form.price && n(form.price) < 0) found.price = "Price cannot be negative";
    if (form.stock && n(form.stock) < 0) found.stock = "Stock cannot be negative";

    if (form.discountPrice && form.price && n(form.discountPrice) > n(form.price)) {
      found.discountPrice = "Discount price cannot exceed the price";
    }

    if (form.gstPercentage && (n(form.gstPercentage) < 0 || n(form.gstPercentage) > 100)) {
      found.gstPercentage = "GST must be between 0 and 100";
    }

    if (form.minOrderQty && n(form.minOrderQty) < 1) {
      found.minOrderQty = "Minimum order quantity must be at least 1";
    }

    return found;
  }, [form]);

  const missingImages = [
    !frontImage && "front image",
    !backImage && "back image",
  ].filter(Boolean);

  const blockers = Object.keys(errors).length + missingImages.length;
  const show = (key) => (touched ? errors[key] : undefined);

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

  const reset = useCallback(() => {
    setForm(EMPTY);
    setCertificates([]);
    setCertDraft("");
    setFrontImage(null);
    setBackImage(null);
    setTouched(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (blockers) {
      toast.error(
        missingImages.length && !Object.keys(errors).length
          ? `Please add the ${missingImages.join(" and ")}`
          : "Please fix the highlighted fields",
      );
      return;
    }

    const data = new FormData();

    /* Optional fields are omitted rather than sent blank, so the server
       stores them as unset instead of coercing "" into a number. */
    Object.entries(form).forEach(([key, value]) => {
      const text = String(value ?? "").trim();
      if (text !== "") data.append(key, text);
    });

    if (certificates.length) data.append("certificates", certificates.join(","));
    data.append("frontImage", frontImage);
    data.append("backImage", backImage);

    try {
      setLoading(true);
      await createProduct(data);

      toast.success(`${form.name} added to the catalog`);
      reset();
    } catch (error) {
      /* The API returns useful messages such as "Product with this SKU
         already exists"; the old form replaced them with a generic string. */
      toast.error(
        error?.response?.data?.message || "Could not create this product",
      );
    } finally {
      setLoading(false);
    }
  };

  const hasDiscount =
    form.discountPrice && n(form.discountPrice) < n(form.price);

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6"
      noValidate>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== FORM ===== */}
        <div className="space-y-5 lg:col-span-8">
          <Section
            title="Basic Information"
            subtitle="How the product is named and described."
            icon={<Package size={17} />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Product Name" required error={show("name")}>
                <input
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Haldi Powder"
                  className={inputClass(show("name"))}
                />
              </Field>

              <Field label="Title" required error={show("title")}>
                <input
                  value={form.title}
                  onChange={set("title")}
                  placeholder="Turmeric, 100g pack"
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
                          "min-h-[160px] p-4 text-[14px] text-slate-700 border-0 outline-none",
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
              <Field
                label="Category"
                required
                error={show("category")}
                hint={categories.length ? `${categories.length} in use` : undefined}>
                <input
                  value={form.category}
                  onChange={set("category")}
                  list="product-categories"
                  placeholder="Spices"
                  className={inputClass(show("category"))}
                />
                <datalist id="product-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>

              <Field label="SKU" required error={show("sku")} hint="must be unique">
                <input
                  value={form.sku}
                  onChange={set("sku")}
                  placeholder="BS-HAL-100"
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
                  placeholder="0"
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
                  placeholder="0"
                  className={inputClass(show("discountPrice"))}
                />
              </Field>

              <Field label="GST %" hint="defaults to 5" error={show("gstPercentage")}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.gstPercentage}
                  onChange={set("gstPercentage")}
                  placeholder="5"
                  className={inputClass(show("gstPercentage"))}
                />
              </Field>

              <Field label="Stock" required error={show("stock")}>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={set("stock")}
                  placeholder="0"
                  className={inputClass(show("stock"))}
                />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Min Order Qty" hint="defaults to 1" error={show("minOrderQty")}>
                <input
                  type="number"
                  min="1"
                  value={form.minOrderQty}
                  onChange={set("minOrderQty")}
                  placeholder="1"
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
                            setCertificates((prev) => prev.filter((c) => c !== cert))
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
            subtitle="Per store type. Leave blank to charge the standard price."
            icon={<Tag size={17} />}>
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-[13px] leading-relaxed text-blue-800">
                These are optional. A tier left empty falls back to the standard
                price at order time, so only fill in the ones that genuinely
                differ.
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
            subtitle="Both are required, front and back of the pack."
            icon={<ImagePlus size={17} />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ImageDrop
                label="Front Image"
                file={frontImage}
                preview={frontPreview}
                onSelect={setFrontImage}
                onClear={() => setFrontImage(null)}
              />
              <ImageDrop
                label="Back Image"
                file={backImage}
                preview={backPreview}
                onSelect={setBackImage}
                onClear={() => setBackImage(null)}
              />
            </div>

            {touched && missingImages.length > 0 && (
              <p className="mt-2 text-[12.5px] text-rose-600">
                Please add the {missingImages.join(" and ")}.
              </p>
            )}
          </Section>
        </div>

        {/* ===== PREVIEW & SAVE ===== */}
        <div className="lg:col-span-4">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                Preview
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                How this product will read in the catalog.
              </p>
            </div>

            <div className="p-5">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid h-40 place-items-center bg-slate-50">
                  {frontPreview ? (
                    <img
                      src={frontPreview}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-center text-slate-300">
                      <ImagePlus size={26} className="mx-auto" />
                      <span className="mt-1.5 block text-[12.5px]">
                        Front image
                      </span>
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <p className="truncate text-[15px] font-semibold text-slate-900">
                    {form.name || "Product name"}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {form.title || "Title appears here"}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {form.category && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
                        {form.category}
                      </span>
                    )}
                    {form.uom && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
                        per {form.uom}
                      </span>
                    )}
                    {form.sku && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-500">
                        {form.sku}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-[19px] font-semibold tabular-nums text-slate-900">
                      {inr(hasDiscount ? form.discountPrice : form.price)}
                    </span>
                    {hasDiscount && (
                      <span className="text-[14px] tabular-nums text-slate-400 line-through">
                        {inr(form.price)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[12.5px] text-slate-400">
                    {form.stock ? `${n(form.stock)} in stock` : "Stock not set"}
                    {form.gstPercentage ? ` · ${n(form.gstPercentage)}% GST` : ""}
                  </p>

                  {certificates.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {certificates.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-700">
                          <BadgeCheck size={11} />
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* TIER SUMMARY */}
              {(form.retailerPrice || form.wholesalerPrice || form.distributorPrice) && (
                <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                    Tier pricing
                  </p>
                  {[
                    ["Retailer", form.retailerPrice],
                    ["Wholesaler", form.wholesalerPrice],
                    ["Distributor", form.distributorPrice],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {value ? inr(value) : "standard"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ACTIONS */}
              <div className="mt-5 space-y-2">
                {touched && blockers > 0 && (
                  <p className="text-center text-[12.5px] text-rose-600">
                    {blockers} item{blockers === 1 ? "" : "s"} still need
                    attention
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Creating…" : "Create Product"}
                </button>

                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                  <RotateCcw size={14} />
                  Clear form
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
