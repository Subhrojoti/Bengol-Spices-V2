import React, { useEffect, useState } from "react";
import {
  getAllProducts,
  updateProduct,
  deleteProduct,
} from "../../../../api/services";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditProductDetails from "./EditProductDetails";
import { Tooltip } from "@mui/material";

const HEADER_HEIGHT = 80;

const AllProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data.products || []);
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(selectedProduct._id);
      toast.success("Product deleted successfully");
      setShowDeleteModal(false);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Loading products...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <div
        className="fixed top-0 left-[3%] right-0 z-10 bg-white border-b px-8 flex items-center"
        style={{ height: HEADER_HEIGHT }}>
        <div>
          <h1 className="text-xl font-semibold">All Products</h1>
          <p className="text-sm text-slate-500">Manage your product catalog</p>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <div
        className="h-full overflow-y-auto px-8 py-6"
        style={{ paddingTop: HEADER_HEIGHT + 20 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onView={() => navigate(`/admin/allproducts/${product._id}`)}
              onEdit={() => {
                setSelectedProduct(product);
                setShowEditModal(true);
              }}
              onDelete={() => {
                setSelectedProduct(product);
                setShowDeleteModal(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <DeleteModal
          product={selectedProduct}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <EditProductDetails
          product={selectedProduct}
          onClose={() => setShowEditModal(false)}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
};

/* ================= PRODUCT CARD ================= */

const ProductCard = ({ product, onEdit, onDelete, onView }) => (
  <div
    onClick={onView}
    className="bg-white border rounded-2xl shadow-sm group cursor-pointer hover:shadow-md transition flex flex-col">
    {/* IMAGE SECTION (1:1 ratio) */}
    <div className="relative w-full aspect-square bg-white rounded-t-2xl flex items-center justify-center overflow-hidden border-b">
      <img
        src={product.images?.front?.url}
        alt={product.name}
        className="max-h-full max-w-full object-contain"
      />

      {/* Action Buttons */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
        <Tooltip title="Edit Product" arrow>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 bg-white rounded shadow hover:bg-blue-50 transition">
            <EditIcon fontSize="small" className="text-blue-600" />
          </button>
        </Tooltip>

        <Tooltip title="Delete Product" arrow>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 bg-white rounded shadow hover:bg-red-50 transition">
            <DeleteOutlineIcon fontSize="small" className="text-red-600" />
          </button>
        </Tooltip>
      </div>
    </div>

    {/* TEXT SECTION */}
    <div className="p-4 flex flex-col flex-1">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 truncate">
            {product.name}
          </h3>
          <p className="text-xs text-slate-500 truncate">{product.title}</p>
        </div>

        {/* PRICE RIGHT SIDE */}
        <div className="text-right">
          <p className="text-sm font-semibold text-blue-600">
            ₹ {product.discountPrice || product.price}
          </p>
        </div>
      </div>
    </div>
  </div>
);

/* ================= DELETE MODAL ================= */

const DeleteModal = ({ product, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg w-[360px]">
      <h3 className="text-lg font-semibold">Delete Product</h3>
      <p className="text-sm mt-2">
        Delete <b>{product.name}</b>?
      </p>
      <div className="flex justify-end gap-3 mt-6">
        <button className="border px-4 py-2 rounded" onClick={onClose}>
          Cancel
        </button>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded"
          onClick={onConfirm}>
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default AllProducts;
