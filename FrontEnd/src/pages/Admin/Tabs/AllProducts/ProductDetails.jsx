import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSingleProduct } from "../../../../api/services";
import { toast } from "react-toastify";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

const ProductDetails = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await getSingleProduct(productId);
      const productData = response.product;
      setProduct(productData);
      setSelectedImage(productData?.images?.front?.url);
    } catch {
      toast.error("Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Loading Product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Product not found
      </div>
    );
  }

  const discount =
    product.price && product.discountPrice
      ? product.price - product.discountPrice
      : 0;

  const discountPercent =
    discount && product.price
      ? Math.round((discount / product.price) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 px-8 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}

        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-2 mb-6 
             text-sm font-semibold text-slate-800 
             hover:text-blue-600 transition-colors duration-200">
          <ArrowBackRoundedIcon
            sx={{ fontSize: 26 }}
            className="transition-transform duration-200 group-hover:-translate-x-1"
          />
          Back to Products
        </button>
        {/* MAIN SECTION */}
        <div className="bg-white rounded-2xl shadow p-10">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* LEFT SIDE - IMAGES */}
            <div className="flex gap-6">
              {/* Thumbnails */}
              <div className="flex flex-col gap-4">
                {Object.values(product.images || {}).map(
                  (img, index) =>
                    img?.url && (
                      <img
                        key={index}
                        src={img.url}
                        alt="thumb"
                        onClick={() => setSelectedImage(img.url)}
                        className={`w-20 h-20 object-cover rounded-lg border cursor-pointer transition 
                        ${
                          selectedImage === img.url
                            ? "border-blue-600"
                            : "border-slate-200"
                        }`}
                      />
                    ),
                )}
              </div>

              {/* Main Image */}
              <div className="flex-1 bg-slate-50 rounded-xl flex items-center justify-center p-6">
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="max-h-[450px] object-contain"
                />
              </div>
            </div>

            {/* RIGHT SIDE - DETAILS */}
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {product.name}
              </h1>

              <p className="text-slate-500 mt-2">{product.title}</p>

              {/* Price Section */}
              <div className="mt-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-blue-600">
                    ₹ {product.discountPrice || product.price}
                  </span>

                  {product.discountPrice && (
                    <span className="line-through text-slate-400 text-lg">
                      ₹ {product.price}
                    </span>
                  )}
                </div>

                {discount > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    Discount: ₹ {discount} ({discountPercent}%)
                  </p>
                )}
              </div>

              {/* Stock */}
              <div className="mt-6">
                <p className="text-sm">
                  Availability:{" "}
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-opacity-10 backdrop-blur-sm
                  ${
                    product.stock > 0
                      ? "bg-green-500 text-green-600"
                      : "bg-red-500 text-red-600"
                  }`}>
                    {product.stock > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                </p>
              </div>

              {/* Basic Info */}
              <div className="mt-8 space-y-3 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-900">Brand:</span>{" "}
                  {product.brand}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Category:</span>{" "}
                  {product.category}
                </p>
                <p>
                  <span className="font-medium text-slate-900">SKU:</span>{" "}
                  {product.sku}
                </p>
                <p>
                  <span className="font-medium text-slate-900">UOM:</span>{" "}
                  {product.uom}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Status:</span>{" "}
                  {product.status}
                </p>
              </div>
            </div>
          </div>

          {/* DESCRIPTION SECTION */}
          {product.description && (
            <div className="mt-16 border-t pt-10">
              <h3 className="text-lg font-semibold text-blue-700 mb-4">
                Description
              </h3>
              <div
                className="prose max-w-none text-slate-600"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
