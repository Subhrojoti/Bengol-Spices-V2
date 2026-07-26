import React, { useState } from "react";
import { toast } from "react-toastify";
import { createProduct } from "../../../../api/services";
import ImageIcon from "@mui/icons-material/Image";
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

const HEADER_HEIGHT = 64;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ProductCreation = () => {
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!frontImage || !backImage) {
      toast.error("Please upload both images");
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => formData.append(key, value));
    formData.append("frontImage", frontImage);
    formData.append("backImage", backImage);

    try {
      setLoading(true);
      await createProduct(formData);
      toast.success("Product created successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <div
        className="fixed top-0 left-[3%] right-0 z-10 bg-white border-b border-slate-200 px-8 flex items-center"
        style={{ height: HEADER_HEIGHT }}>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Create Product
          </h1>
          <p className="text-sm text-slate-500">
            Add a new product to your catalog
          </p>
        </div>
      </div>

      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: HEADER_HEIGHT }}>
        <div className="px-8 py-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <form onSubmit={handleSubmit} className="p-6 space-y-10">
              <Section title="Basic Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Product Name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    label="Title"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Description
                  </label>

                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                    <EditorProvider>
                      <Toolbar className="bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 p-2">
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
                            "min-h-[180px] p-4 text-sm text-slate-700 focus:outline-none border-0 outline-none",
                        }}
                      />
                    </EditorProvider>
                  </div>
                </div>
              </Section>

              <Section title="Classification">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Select
                    label="UOM"
                    name="uom"
                    value={form.uom}
                    onChange={handleChange}
                    options={["kg", "gm", "ltr"]}
                  />
                </div>
              </Section>

              <Section title="Pricing & Inventory">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <Input
                    label="Certificates"
                    name="certificates"
                    value={form.certificates}
                    onChange={handleChange}
                  />
                </div>
              </Section>

              {/* NEW SECTION */}
              <Section title="Role-Based Pricing">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </Section>

              <Section title="Product Images">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FileInput
                    label="Front Image"
                    file={frontImage}
                    onFileSelect={setFrontImage}
                  />
                  <FileInput
                    label="Back Image"
                    file={backImage}
                    onFileSelect={setBackImage}
                  />
                </div>
              </Section>

              <div className="pt-6 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
                  {loading ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

/* REUSABLE COMPONENTS */

const Section = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">
      {label}
    </label>
    <input
      {...props}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">
      {label}
    </label>
    <select
      {...props}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
      <option value="">Select</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

const FileInput = ({ label, file, onFileSelect }) => {
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("Image size should not exceed 5 MB");
      e.target.value = "";
      return;
    }

    onFileSelect(selectedFile);
  };

  return (
    <label className="flex items-center gap-4 p-4 rounded-lg cursor-pointer border-2 border-dashed border-slate-300 hover:border-blue-500">
      <div className="w-20 h-20 flex items-center justify-center rounded-md bg-white border border-slate-200 overflow-hidden">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="text-slate-400" fontSize="large" />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          Click to upload image (JPG only, max 5 MB)
        </span>
      </div>

      <input type="file" accept="image/*" hidden onChange={handleFileChange} />
    </label>
  );
};

export default ProductCreation;
