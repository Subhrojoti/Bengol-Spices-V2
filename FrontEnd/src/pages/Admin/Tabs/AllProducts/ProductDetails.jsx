import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  ImageOff,
  Pencil,
  RefreshCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import usePanelBasePath from "../../../../hooks/usePanelBasePath";
import StatusPill from "../../../../components/common/StatusPill";
import EditProductDetails from "./EditProductDetails";
import {
  getSingleProduct,
  deleteProduct,
} from "../../../../api/services";

const LOW_STOCK = 10;

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Spec = ({ label, value, mono }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
    <span className="shrink-0 text-[13px] text-slate-500">{label}</span>
    <span
      className={`min-w-0 truncate text-right text-[14px] font-medium text-slate-800 ${
        mono ? "font-mono tabular-nums" : ""
      }`}>
      {value || "—"}
    </span>
  </div>
);

const Skeleton = () => (
  <div className="min-h-screen animate-pulse bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
    <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="h-[26rem] rounded-2xl bg-slate-200/70" />
      </div>
      <div className="space-y-4 lg:col-span-5">
        <div className="h-48 rounded-2xl bg-slate-200/70" />
        <div className="h-64 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const basePath = usePanelBasePath();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [activeImage, setActiveImage] = useState("");
  const [brokenMain, setBrokenMain] = useState(false);

  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");

    try {
      const res = await getSingleProduct(productId);

      if (!res?.product) {
        setStatus("missing");
        return;
      }

      setProduct(res.product);
      setActiveImage(res.product.images?.front?.url || "");
      setBrokenMain(false);
      setStatus("ready");
    } catch (error) {
      setStatus(error?.response?.status === 404 ? "missing" : "error");
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Explicit order rather than Object.values, which depends on key order */
  const gallery = useMemo(
    () =>
      [
        { label: "Front", url: product?.images?.front?.url },
        { label: "Back", url: product?.images?.back?.url },
      ].filter((i) => i.url),
    [product],
  );

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await deleteProduct(product._id);
      toast.success(`${product.name} removed from the catalog`);
      navigate(`${basePath}/allproducts`, { replace: true });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not delete this product",
      );
      setDeleting(false);
    }
  };

  if (status === "loading") return <Skeleton />;

  if (status === "error" || status === "missing") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            {status === "missing"
              ? "This product no longer exists"
              : "Could not load this product"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {status === "missing"
              ? "It may have been deleted from the catalog."
              : "Check your connection and try again."}
          </p>
          <div className="mt-5 flex justify-center gap-2.5">
            <button
              onClick={() => navigate(`${basePath}/allproducts`)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <ArrowLeft size={14} />
              Back to products
            </button>
            {status === "error" && (
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                <RefreshCcw size={14} />
                Retry
              </button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const stock = n(product.stock);
  const discounted =
    product.discountPrice && n(product.discountPrice) < n(product.price);
  const saving = discounted ? n(product.price) - n(product.discountPrice) : 0;
  const savingPct = saving
    ? Math.round((saving / n(product.price)) * 100)
    : 0;

  const tiers = [
    ["Retailer", product.retailerPrice],
    ["Wholesaler", product.wholesalerPrice],
    ["Distributor", product.distributorPrice],
  ];
  const hasTiers = tiers.some(([, v]) => v !== null && v !== undefined);

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(`${basePath}/allproducts`)}
          className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50">
          <ArrowLeft
            size={15}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          Back to products
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-blue-700">
            <Pencil size={14} />
            Edit
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50">
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== GALLERY ===== */}
        <Card className="p-5 lg:col-span-7">
          <div className="flex gap-4">
            <div className="flex shrink-0 flex-col gap-3">
              {gallery.map((img) => (
                <button
                  key={img.label}
                  onClick={() => {
                    setActiveImage(img.url);
                    setBrokenMain(false);
                  }}
                  title={img.label}
                  className={`h-20 w-20 overflow-hidden rounded-xl border-2 bg-white transition ${
                    activeImage === img.url
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                  <EntityAvatar
                    src={img.url}
                    fallback={<ImageOff size={15} />}
                    bordered={false}
                    className="h-full w-full rounded-lg"
                    imgClassName="object-contain p-1"
                  />
                </button>
              ))}
            </div>

            <div className="grid min-h-[22rem] flex-1 place-items-center rounded-xl bg-slate-50 p-6">
              {activeImage && !brokenMain ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  onError={() => setBrokenMain(true)}
                  className="max-h-[24rem] w-full object-contain"
                />
              ) : (
                <span className="text-center text-slate-300">
                  <ImageOff size={30} className="mx-auto" />
                  <span className="mt-2 block text-[13px]">
                    Image unavailable
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Description
            </h3>
            {product.description ? (
              <div
                className="prose prose-sm mt-2 max-w-none text-[14px] leading-relaxed text-slate-600"
                /* Admin-authored rich text from the product form */
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="mt-2 text-[14px] text-slate-400">
                No description was added for this product.
              </p>
            )}
          </div>
        </Card>

        {/* ===== DETAILS ===== */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
                  {product.name}
                </h1>
                <p className="mt-1 text-[14px] text-slate-500">{product.title}</p>
              </div>
              <StatusPill status={product.status} />
            </div>

            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-[26px] font-semibold leading-none tabular-nums text-slate-900">
                {inr(discounted ? product.discountPrice : product.price)}
              </span>
              {discounted && (
                <span className="text-[16px] tabular-nums text-slate-400 line-through">
                  {inr(product.price)}
                </span>
              )}
              {product.uom && (
                <span className="text-[13px] text-slate-400">
                  per {product.uom}
                </span>
              )}
            </div>

            {discounted && (
              <p className="mt-1.5 inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[12.5px] font-semibold text-emerald-700">
                Saves {inr(saving)} ({savingPct}%)
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ring-1 ring-inset ${
                  stock === 0
                    ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                    : stock < LOW_STOCK
                      ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                }`}>
                {stock < LOW_STOCK && stock > 0 && <TriangleAlert size={12} />}
                {stock === 0 ? "Out of stock" : `${stock} in stock`}
              </span>

              {n(product.gstPercentage) > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12.5px] font-medium tabular-nums text-slate-600">
                  {n(product.gstPercentage)}% GST
                </span>
              )}

              {n(product.minOrderQty) > 1 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12.5px] font-medium tabular-nums text-slate-600">
                  min order {n(product.minOrderQty)}
                </span>
              )}
            </div>

            {product.certificates?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {product.certificates.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[12.5px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <BadgeCheck size={12} />
                    {cert}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* TIER PRICING — the old page never showed these at all */}
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Role-Based Pricing
            </h3>
            <p className="mt-0.5 text-[13px] text-slate-500">
              What each store type is charged.
            </p>

            <div className="mt-3">
              {hasTiers ? (
                tiers.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
                    <span className="text-[13px] text-slate-500">{label}</span>
                    <span className="text-[14px] font-semibold tabular-nums text-slate-800">
                      {value === null || value === undefined ? (
                        <span className="font-normal text-slate-400">
                          standard price
                        </span>
                      ) : (
                        inr(value)
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[14px] text-slate-400">
                  No tier prices set. Every store type pays the standard price.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Specifications
            </h3>
            <div className="mt-2">
              <Spec label="Brand" value={product.brand} />
              <Spec label="Category" value={product.category} />
              <Spec label="SKU" value={product.sku} mono />
              <Spec label="Unit of measure" value={product.uom} />
              <Spec
                label="Added on"
                value={
                  product.createdAt
                    ? new Date(product.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : null
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ===== DIALOGS ===== */}
      {editing && (
        <EditProductDetails
          product={product}
          onClose={() => setEditing(false)}
          onSuccess={load}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        busy={deleting}
        tone="danger"
        icon={<Trash2 size={18} />}
        title="Delete this product?"
        description="The product and both of its images are removed permanently. This cannot be undone."
        detail={
          <div className="flex items-center gap-3">
            <EntityAvatar
              src={product.images?.front?.url}
              fallback={<ImageOff size={16} />}
              className="h-11 w-11 rounded-lg"
              imgClassName="bg-white object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-slate-900">
                {product.name}
              </p>
              <p className="truncate font-mono text-[12.5px] text-slate-500">
                {product.sku}
              </p>
            </div>
          </div>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
