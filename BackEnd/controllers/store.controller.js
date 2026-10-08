import crypto from "crypto";
import Store from "../models/store.js";
import cloudinary from "../config/cloudinary.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentSalesLocation from "../models/AgentSalesLocation.js";
import Counter from "../models/Counter.js";
import Product from "../models/Product.js";
import { updateTargetProgress } from "../services/target.service.js";
import {
  applyLocationPrices,
  effectivePrice,
  getLocationOverrides,
} from "../utils/pricing.js";

// The same fields the public catalogue exposes
const CATALOGUE_FIELDS =
  "name title description category uom price discountPrice retailerPrice wholesalerPrice distributorPrice images gstPercentage minOrderQty";

/**
 * THE CATALOGUE AS ONE STORE SEES IT (Agent, own store only)
 *
 * The public catalogue carries the default prices. This returns the same
 * products with the territory's location prices applied, so the apps show
 * exactly what the server will charge when the order is placed. Field names
 * match the public catalogue; `effectivePrice` is the single price for this
 * store's type and `priceSource` says where it came from.
 */
export const getStoreCatalog = async (req, res) => {
  try {
    const { consumerId } = req.params;

    const store = await Store.findOne({
      consumerId,
      registeredBy: req.user.agentId,
    })
      .select("consumerId storeName storeType address.state")
      .lean();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    const [products, overrides] = await Promise.all([
      Product.find({ status: "ACTIVE" })
        .select(CATALOGUE_FIELDS)
        .sort({ createdAt: -1 })
        .lean(),
      getLocationOverrides(req.user.agentId, store.address?.state),
    ]);

    const priced = products.map((product) => {
      const override = overrides.get(String(product._id));
      const { fromLocation, ...tierPrices } = applyLocationPrices(
        product,
        override,
      );
      const { price, source } = effectivePrice(
        product,
        store.storeType,
        override,
      );

      return {
        ...product,
        ...tierPrices,
        effectivePrice: price,
        priceSource: source,
        locationPricing: fromLocation,
      };
    });

    return res.json({
      success: true,
      count: priced.length,
      store: {
        consumerId: store.consumerId,
        storeName: store.storeName,
        storeType: store.storeType,
        state: store.address?.state,
      },
      products: priced,
    });
  } catch (error) {
    console.error("GET STORE CATALOG ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products for this store",
    });
  }
};

//Store Creation - POST /api/stores
export const createStore = async (req, res) => {
  /* The delivery code is a credential, not just an identifier: the store
     owner reads it out at handover and the delivery partner types it in to
     confirm the order really arrived. Math.random is a predictable
     generator - its internal state can be recovered from a handful of
     outputs - so a partner who legitimately sees a few codes could work
     out other stores codes and confirm deliveries that never happened.
     crypto.randomInt draws on the same source as the other credentials
     here. The format is unchanged: six digits, 100000 to 999999. */
  const generateDeliveryCode = async () => {
    let code;
    let exists = true;

    while (exists) {
      code = String(crypto.randomInt(100000, 1000000));
      exists = await Store.findOne({ deliveryCode: code });
    }

    return code;
  };

  let uploadedImageId = null;

  try {
    const {
      storeName,
      ownerName,
      phone,
      state,
      city,
      street,
      pincode,
      latitude,
      longitude,
      storeType,
    } = req.body;

    if (
      !storeName ||
      !ownerName ||
      !phone ||
      !state ||
      !city ||
      !street ||
      !pincode ||
      latitude === undefined ||
      longitude === undefined ||
      !storeType
    ) {
      throw new Error("All fields including complete address are required");
    }

    if (!req.file) {
      throw new Error("Store image is required");
    }

    uploadedImageId = req.file.filename;

    // 🔥 FIX: validate the captured GPS coordinate is a real, usable
    // location — not missing/garbage text (Number("abc") === NaN would
    // otherwise silently get stored), and not the (0,0) "Null Island"
    // value a device can send when it fails to get an actual GPS fix.
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (lat === 0 && lng === 0)
    ) {
      throw new Error(
        "A valid store location is required. Please enable location access on your device and try again.",
      );
    }

    // Rough bounding box for India — this business only operates within
    // India (see GSTIN/registered office/pincode format used elsewhere),
    // so a coordinate outside it almost always means location access
    // failed and a default/fallback value slipped through instead.
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      throw new Error(
        "Store location looks incorrect (outside India). Please make sure location access is granted and try again.",
      );
    }

    // Stored trimmed, so compared trimmed: " 9831431018" slipped past the
    // duplicate check and then failed the unique index with a raw error,
    // and a stray space in state or pincode failed the location check below.
    const cleanPhone = String(phone).trim();
    const cleanState = String(state).trim().toUpperCase();
    const cleanPincode = String(pincode).trim();

    const exists = await Store.findOne({ phone: cleanPhone });
    if (exists) {
      throw new Error("Store already registered with this phone");
    }

    // 🔥 FIX: two different stores should never share the exact same
    // coordinate. A genuine GPS reading has enough natural precision/jitter
    // that two real on-site visits will not match to this many decimal
    // places — an exact match almost always means a stale, cached, or
    // reused location was submitted instead of a fresh reading taken at
    // this store.
    const duplicateLocation = await Store.findOne({
      "location.latitude": lat,
      "location.longitude": lng,
    });

    if (duplicateLocation) {
      throw new Error(
        "This exact location is already registered to another store. Please make sure you are physically at this store before registering it.",
      );
    }

    // ✅ CHECK AGENT LOCATION PERMISSION
    const agentId = req.user.agentId;

    const assignedLocations = await AgentSalesLocation.find({
      agentId,
      state: cleanState,
    });

    if (!assignedLocations || assignedLocations.length === 0) {
      throw new Error("You are not authorized to sell in this location");
    }

    const allowedPincodes = assignedLocations.flatMap((loc) =>
      (loc.pincodes || []).map((pin) => String(pin).trim()),
    );

    if (!allowedPincodes.includes(cleanPincode)) {
      throw new Error("You are not authorized to sell in this location");
    }

    // 🔑 ✅ SAFE consumerId generation using Counter. Taken only once every
    // check has passed; it used to run first, so each refused attempt used
    // up a consumer ID and left a gap in the sequence.
    const year = new Date().getFullYear();

    const counter = await Counter.findByIdAndUpdate(
      `store-${year}`, // unique key per year
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const consumerId = `CS${year}-${String(counter.seq).padStart(4, "0")}`;

    const deliveryCode = await generateDeliveryCode();

    const store = await Store.create({
      consumerId,
      deliveryCode,
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      phone: cleanPhone,
      address: {
        state: cleanState,
        city: city.trim(),
        street: street.trim(),
        pincode: cleanPincode,
      },
      location: {
        latitude: lat,
        longitude: lng,
      },
      storeType,
      registeredBy: req.user.agentId,
      image: {
        url: req.file.path,
        publicId: req.file.filename,
      },
      status: "ACTIVE",
    });

    await updateTargetProgress({
      agentId: req.user.agentId,
      type: "STORE_CREATION",
      value: 1,
    });
    return res.status(201).json({
      success: true,
      message: "Store registered successfully",
      consumerId: store.consumerId,
      deliveryCode: store.deliveryCode,
    });
  } catch (error) {
    if (uploadedImageId) {
      // A failed clean-up must not replace the real reason with a 500
      await cloudinary.uploader
        .destroy(uploadedImageId)
        .catch((cleanupError) =>
          console.error("STORE IMAGE CLEANUP FAILED:", cleanupError),
        );
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// GET STORES REGISTERED BY LOGGED-IN AGENT
export const getMyStores = async (req, res) => {
  try {
    // 🔒 agentId comes from JWT
    const agentId = req.user.agentId;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Agent identity missing in token",
      });
    }

    const stores = await Store.find({ registeredBy: agentId }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      count: stores.length,
      stores,
    });
  } catch (error) {
    console.error("GET MY STORES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stores",
    });
  }
};

/**
 * LIST ALL STORES (Admin / Employee who can see all orders)
 *
 * Orders only embed a flattened delivery address — store name, owner, phone
 * and location — with no link back to the store record, so the admin panel
 * had no way to show a store's photo or type beside its orders.
 */
export const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find()
      .select(
        "consumerId storeName ownerName phone address storeType image status registeredBy createdAt",
      )
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: stores.length,
      stores,
    });
  } catch (error) {
    console.error("GET ALL STORES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stores",
    });
  }
};
