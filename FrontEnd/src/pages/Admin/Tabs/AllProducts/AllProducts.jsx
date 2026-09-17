import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertCircle,
  ArrowUpDown,
  Boxes,
  ImageOff,
  PackageX,
  Pencil,
  RefreshCcw,
  Search,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import EditProductDetails from "./EditProductDetails";
import { getAllProducts, deleteProduct } from "../../../../api/services";
import usePanelBasePath from "../../../../hooks/usePanelBasePath";

const LOW_STOCK = 10;

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Stock" },
];

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

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
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint, color: ink }}>
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

const StockBadge = ({ stock }) => {
  const count = n(stock);

  const tone =
    count === 0
      ? "bg-rose-50 text-rose-700 ring-rose-600/20"
      : count < LOW_STOCK
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : "bg-emerald-50 text-emerald-700 ring-emerald-600/20";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ring-1 ring-inset ${tone}`}>
      {count === 0 ? "Out of stock" : `${count} in stock`}
    </span>
  );
};

const GridSkeleton = () => (
  <div className="grid animate-pulse grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="aspect-square bg-slate-100" />
        <div className="space-y-2 p-4">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="h-2.5 w-24 rounded bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const ProductCard = ({ product, onView, onEdit, onDelete }) => {
  const [broken, setBroken] = useState(false);
  const discounted =
    product.discountPrice && n(product.discountPrice) < n(product.price);

  return (
    <Card className="group flex flex-col overflow-hidden transition hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-16px_rgba(15,23,42,0.25)]">
      <button
        onClick={onView}
        className="relative block aspect-square w-full overflow-hidden border-b border-slate-100 bg-white">
        {product.images?.front?.url && !broken ? (
          <img
            src={product.images.front.url}
            alt={product.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-slate-300">
            <ImageOff size={26} />
          </span>
        )}

        {product.status === "INACTIVE" && (
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            Inactive
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onView} className="min-w-0 flex-1 text-left">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">
              {product.name}
            </h3>
            <p className="truncate text-[13px] text-slate-500">{product.title}</p>
          </button>

          {/* Always visible: the old buttons only appeared on hover, so they
              could not be reached on a touch screen at all. */}
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onEdit}
              title="Edit product"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">
              <Pencil size={15} />
            </button>
            <button
              onClick={onDelete}
              title="Delete product"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {product.category && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
              {product.category}
            </span>
          )}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-500">
            {product.sku}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-semibold tabular-nums text-slate-900">
                {inr(discounted ? product.discountPrice : product.price)}
              </span>
              {discounted && (
                <span className="text-[13px] tabular-nums text-slate-400 line-through">
                  {inr(product.price)}
                </span>
              )}
            </div>
            {product.uom && (
              <p className="text-[12px] text-slate-400">per {product.uom}</p>
            )}
          </div>

          <StockBadge stock={product.stock} />
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ */

export default function AllProducts() {
  const navigate = useNavigate();
  const basePath = usePanelBasePath();

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("newest");

  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const data = await getAllProducts();
      setProducts(data?.products || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch products", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  const stats = useMemo(
    () => ({
      total: products.length,
      outOfStock: products.filter((p) => n(p.stock) === 0).length,
      lowStock: products.filter(
        (p) => n(p.stock) > 0 && n(p.stock) < LOW_STOCK,
      ).length,
      categories: categories.length,
    }),
    [products, categories],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = products
      .filter((p) => category === "ALL" || p.category === category)
      .filter((p) =>
        !term
          ? true
          : [p.name, p.title, p.sku, p.category]
              .filter(Boolean)
              .some((f) => String(f).toLowerCase().includes(term)),
      );

    const sorted = [...filtered];

    if (sort === "name") {
      sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (sort === "price") {
      sorted.sort(
        (a, b) => n(a.discountPrice || a.price) - n(b.discountPrice || b.price),
      );
    } else if (sort === "stock") {
      sorted.sort((a, b) => n(a.stock) - n(b.stock));
    } else {
      sorted.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    }

    return sorted;
  }, [products, search, category, sort]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await deleteProduct(deleteTarget._id);

      setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      toast.success(`${deleteTarget.name} removed from the catalog`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not delete this product",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load products
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
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Products"
          value={stats.total}
          icon={<Boxes size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Categories"
          value={stats.categories}
          icon={<Tag size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Low stock"
          value={stats.lowStock}
          icon={<TriangleAlert size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="Out of stock"
          value={stats.outOfStock}
          icon={<PackageX size={17} />}
          tint="#fdeaea"
          ink="#c02f2f"
        />
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCategory("ALL")}
            className={`rounded-lg px-3 py-1.5 text-[13.5px] font-medium ring-1 ring-inset transition ${
              category === "ALL"
                ? "bg-blue-600 text-white ring-blue-600"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-[13.5px] font-medium ring-1 ring-inset transition ${
                category === c
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}>
              {c}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, title or SKU"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-64"
          />
        </div>

        <div className="relative">
          <ArrowUpDown
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[14px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ===== GRID ===== */}
      {status === "loading" ? (
        <GridSkeleton />
      ) : visible.length === 0 ? (
        <Card className="p-16 text-center">
          <Boxes size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {products.length === 0
              ? "No products yet"
              : "No products match this view"}
          </p>
          <p className="mt-1 text-[14px] text-slate-400">
            {products.length === 0
              ? "Add your first product from the Product Creation page."
              : "Try another category or clear the search."}
          </p>
        </Card>
      ) : (
        <>
          <p className="text-[13px] text-slate-500">
            Showing{" "}
            <span className="font-semibold tabular-nums text-slate-800">
              {visible.length}
            </span>{" "}
            of {products.length}
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onView={() => navigate(`${basePath}/allproducts/${product._id}`)}
                onEdit={() => setEditTarget(product)}
                onDelete={() => setDeleteTarget(product)}
              />
            ))}
          </div>
        </>
      )}

      {/* ===== DIALOGS ===== */}
      {editTarget && (
        <EditProductDetails
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => load(true)}
        />
      )}

      {/* The API hard-deletes the record and destroys both Cloudinary images.
          The old dialog just asked "Delete X?" with no hint of that. */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={deleting}
        tone="danger"
        icon={<Trash2 size={18} />}
        title="Delete this product?"
        description="The product and both of its images are removed permanently. This cannot be undone."
        detail={
          deleteTarget && (
            <div className="flex items-center gap-3">
              <EntityAvatar
                src={deleteTarget.images?.front?.url}
                fallback={<ImageOff size={16} />}
                className="h-11 w-11 rounded-lg"
                imgClassName="bg-white object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {deleteTarget.name}
                </p>
                <p className="truncate font-mono text-[12.5px] text-slate-500">
                  {deleteTarget.sku}
                </p>
              </div>
            </div>
          )
        }
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
