import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { updateProduct } from "../../../../api/services";
import ImageIcon from "@mui/icons-material/Image";
import CloseIcon from "@mui/icons-material/Close";
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const EditProductDetails = ({ product, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
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
    certificates: "",
    retailerPrice: "",
    wholesalerPrice: "",
    distributorPrice: "",
  });

  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        title: product.title || "",
        description: product.description || "",
        category: product.category || "",
        sku: product.sku || "",
        uom: product.uom || "",
        price: product.price || "",
        discountPrice: product.discountPrice || "",
        gstPercentage: product.gstPercentage || "",
        stock: product.stock || "",
        minOrderQty: product.minOrderQty || "",
        certificates: product.certificates?.join(", ") || "",
        retailerPrice: product.retailerPrice || "",
        wholesalerPrice: product.wholesalerPrice || "",
        distributorPrice: product.distributorPrice || "",
      });
    }
  }, [product]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    if (frontImage) formData.append("frontImage", frontImage);
    if (backImage) formData.append("backImage", backImage);

    try {
      setLoading(true);
      await updateProduct(product._id, formData);
      toast.success("Product updated successfully");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center overflow-y-auto p-6">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-red-500">
          <CloseIcon />
        </button>

        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-semibold text-slate-800">
            Edit Product
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* BASIC INFO */}
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Product Name"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
              <Input
                label="Title"
                name="title"
                value={form.title}
                onChange={handleChange}
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>

              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <EditorProvider>
                  <Toolbar className="bg-slate-50 border-b flex gap-2 p-2">
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
                        "min-h-[200px] p-4 text-sm text-slate-700 focus:outline-none",
                    }}
                  />
                </EditorProvider>
              </div>
            </div>

            {/* CLASSIFICATION */}
            <div className="grid md:grid-cols-3 gap-4">
              <Input
                label="Category"
                name="category"
                value={form.category}
                onChange={handleChange}
              />
              <Input
                label="SKU"
                name="sku"
                value={form.sku}
                onChange={handleChange}
              />
              <Input
                label="UOM"
                name="uom"
                value={form.uom}
                onChange={handleChange}
              />
            </div>

            {/* PRICING */}
            <div className="grid md:grid-cols-4 gap-4">
              <Input
                label="Price"
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
              />
              <Input
                label="Discount Price"
                type="number"
                name="discountPrice"
                value={form.discountPrice}
                onChange={handleChange}
              />
              <Input
                label="GST %"
                type="number"
                name="gstPercentage"
                value={form.gstPercentage}
                onChange={handleChange}
              />
              <Input
                label="Stock"
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Min Order Qty"
                type="number"
                name="minOrderQty"
                value={form.minOrderQty}
                onChange={handleChange}
              />
              {/* ROLE-BASED PRICING */}
              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Retailer Price"
                  type="number"
                  name="retailerPrice"
                  value={form.retailerPrice}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Wholesaler Price"
                  type="number"
                  name="wholesalerPrice"
                  value={form.wholesalerPrice}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Distributor Price"
                  type="number"
                  name="distributorPrice"
                  value={form.distributorPrice}
                  onChange={handleChange}
                  required
                />
              </div>
              <Input
                label="Certificates"
                name="certificates"
                value={form.certificates}
                onChange={handleChange}
              />
            </div>

            {/* IMAGES */}
            <div className="grid md:grid-cols-2 gap-4">
              <FileInput
                label="Front Image"
                existing={product.images?.front?.url}
                file={frontImage}
                onFileSelect={setFrontImage}
              />
              <FileInput
                label="Back Image"
                existing={product.images?.back?.url}
                file={backImage}
                onFileSelect={setBackImage}
              />
            </div>

            {/* ACTION */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg border">
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Updating..." : "Update Product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-medium mb-1">{label}</label>
    <input
      {...props}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  </div>
);

const FileInput = ({ label, file, existing, onFileSelect }) => {
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      toast.error("Image size should not exceed 5MB");
      return;
    }

    onFileSelect(selected);
  };

  return (
    <label className="border-2 border-dashed border-slate-300 p-4 rounded-lg cursor-pointer hover:border-blue-500 flex gap-4 items-center">
      <div className="w-20 h-20 bg-white border rounded-md flex items-center justify-center overflow-hidden">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="w-full h-full object-cover"
          />
        ) : existing ? (
          <img
            src={existing}
            alt="existing"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="text-slate-400" />
        )}
      </div>

      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500">
          Click to upload image (JPG only, max 5MB)
        </p>
      </div>

      <input type="file" hidden accept="image/*" onChange={handleFileChange} />
    </label>
  );
};

export default EditProductDetails;
