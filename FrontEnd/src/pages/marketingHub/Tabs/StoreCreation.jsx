import { useState } from "react";
import { toast } from "react-toastify";
import { createStore } from "../../../api/services";

const StoreCreation = () => {
  const [formData, setFormData] = useState({
    storeName: "",
    ownerName: "",
    phone: "",
    state: "",
    city: "",
    street: "",
    pincode: "",
    storeType: "",
    image: null,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "image") {
      setFormData((prev) => ({ ...prev, image: files[0] }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocation is not supported by this browser.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject("Location permission denied. Please allow location access.");
          } else {
            reject("Unable to fetch location. Please try again.");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        },
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      const { latitude, longitude } = await getLocation();

      const payload = {
        storeName: formData.storeName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        state: formData.state,
        city: formData.city,
        street: formData.street,
        pincode: formData.pincode,
        latitude,
        longitude,
        storeType: formData.storeType,
        image: formData.image,
      };

      await createStore(payload);

      toast.success("Store created successfully");

      setFormData({
        storeName: "",
        ownerName: "",
        phone: "",
        state: "",
        city: "",
        street: "",
        pincode: "",
        storeType: "",
        image: null,
      });
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err?.response?.data?.message || "Failed to create store",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800">
            Create New Store
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter store details registered by the agent
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Store Name *
              </label>
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Owner Name *
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Store Image
              </label>
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={handleChange}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                State *
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Street *
              </label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Pincode *
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                required
                className="w-full h-12 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Store Type *
              </label>
              <div className="flex items-center gap-8 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="storeType"
                    value="RETAILER"
                    checked={formData.storeType === "RETAILER"}
                    onChange={handleChange}
                    required
                  />
                  Retailer
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="storeType"
                    value="WHOLESALER"
                    checked={formData.storeType === "WHOLESALER"}
                    onChange={handleChange}
                  />
                  Wholesaler
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="storeType"
                    value="DISTRIBUTOR"
                    checked={formData.storeType === "DISTRIBUTOR"}
                    onChange={handleChange}
                  />
                  Distributor
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-10">
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg text-sm font-medium shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? "Creating..." : "Create Store"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreCreation;
