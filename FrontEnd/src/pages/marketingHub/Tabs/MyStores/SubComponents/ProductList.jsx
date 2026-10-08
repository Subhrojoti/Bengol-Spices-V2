import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Badge,
} from "@mui/material";

import { ShoppingCartOutlined } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { fetchStoreProducts } from "../../../../../api/services";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../../../../redux/slices/addToCart/addToCart";
import { setLeftView } from "../../../../../redux/slices/myStoresUi/myStoresUi";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";

const ProductList = ({ onBack }) => {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [imageIndex, setImageIndex] = useState({});

  // Quantities typed on one page are kept while another page is looked at
  const [pager, pagerTop] = usePagination(products, { pageSize: 12 });

  const selectedStore = useSelector((state) => state.myStoresUi.selectedStore);

  const dispatch = useDispatch();

  /* Every hook sits above the "no store selected" return below. Two of them
     used to come after it. React needs the same hooks, in the same order,
     on every render, so the moment the selected store was cleared or set
     while this screen was open it threw "Rendered fewer hooks than
     expected" and the whole panel fell over to the error page. */
  const consumerId = selectedStore?.consumerId;

  const cartCount = useSelector((state) => {
    if (!consumerId) return 0;

    const items = state.addToCart.carts[consumerId]?.items || [];

    return items.length;
  });

  /* ---------------- API ---------------- */
  useEffect(() => {
    if (!consumerId) return undefined; // no store selected: nothing to load

    let cancelled = false;

    const loadProducts = async () => {
      try {
        // Priced for this store, so any location price the admin set shows here
        const res = await fetchStoreProducts(consumerId);
        if (!cancelled) setProducts(res?.products || []);
      } catch (error) {
        // Left as an empty list, as before; just not an unhandled rejection
        console.error("Could not load products for this store:", error);
        if (!cancelled) setProducts([]);
      }
    };

    loadProducts();

    // A slow answer for the previous store must not overwrite this one's list
    return () => {
      cancelled = true;
    };
  }, [consumerId]);

  if (!selectedStore) {
    return (
      <Box
        height="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap={2}>
        <Typography variant="h6" fontWeight={600}>
          No store selected
        </Typography>

        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => dispatch(setLeftView("LIST"))}>
          Back to Stores
        </Button>
      </Box>
    );
  }

  const storeName = selectedStore.storeName;
  const storeType = selectedStore.storeType?.toUpperCase(); // 👈 extracted once

  const FallBackImage =
    "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2";

  /* ---------------- ROLE-BASED PRICE HELPER ---------------- */
  const getUnitPrice = (product) => {
    if (storeType === "RETAILER") return product.retailerPrice;
    if (storeType === "WHOLESALER") return product.wholesalerPrice;
    if (storeType === "DISTRIBUTOR") return product.distributorPrice;
    return product.discountPrice ?? product.price; // fallback
  };

  /* ---------------- IMAGE SLIDER ---------------- */
  const handleImageChange = (id, direction, max) => {
    setImageIndex((prev) => {
      const current = prev[id] || 0;
      const next =
        direction === "next" ? (current + 1) % max : (current - 1 + max) % max;

      return { ...prev, [id]: next };
    });
  };

  /* ---------------- HANDLERS ---------------- */
  const handleQuantityChange = (id, value) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: value === "" ? "" : Number(value),
    }));
  };

  const handleAddToCart = (product) => {
    const qty = Number(quantities[product._id]);

    if (!qty || qty <= 0) return;

    dispatch(
      addToCart({
        consumerId,
        product: {
          id: product._id,
          name: product.name,
          uom: product.uom,
          unitPrice: getUnitPrice(product), // 👈 role-aware
          quantity: qty,
          image: product.images?.front?.url,
        },
      }),
    );

    // Optional: reset quantity after adding
    setQuantities((prev) => ({
      ...prev,
      [product._id]: "",
    }));
  };

  /* ---------------- UI ---------------- */
  return (
    <Box p={2}>
      {/* HEADER */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <IconButton onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>

          <Box>
            <Typography fontWeight={700} fontSize={16} lineHeight={1.2}>
              {storeName}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              Ordering products for this store
            </Typography>
          </Box>
        </Box>

        {/* CART ICON */}
        <IconButton size="small" onClick={() => dispatch(setLeftView("CART"))}>
          <Badge
            badgeContent={cartCount}
            color="warning"
            invisible={cartCount === 0}>
            <ShoppingCartOutlined />
          </Badge>
        </IconButton>
      </Box>

      {/* PRODUCTS GRID */}
      <Grid
        container
        spacing={3}
        ref={pagerTop}
        sx={{ paddingLeft: 3.5, scrollMarginTop: 96 }}>
        {pager.pageItems.map((product) => {
          const qty = Number(quantities[product._id]) || 0;

          const unitPrice = getUnitPrice(product); // 👈 role-aware

          const totalPrice = qty * unitPrice;

          const images = [
            product.images?.front?.url,
            product.images?.back?.url,
          ].filter(Boolean);

          const activeImage = imageIndex[product._id] || 0;

          return (
            <Grid item xs={12} sm={6} md={4} key={product._id}>
              <Card
                sx={{
                  width: 280,
                  height: 400,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                }}>
                {/* IMAGE */}
                <Box
                  position="relative"
                  sx={{
                    height: 220,
                    width: "100%",
                    backgroundColor: "#000",
                    overflow: "hidden",
                  }}>
                  <Box
                    component="img"
                    src={images[activeImage] || FallBackImage}
                    alt={product.name}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />

                  {images.length > 1 && (
                    <>
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleImageChange(product._id, "prev", images.length)
                        }
                        sx={{
                          position: "absolute",
                          top: "50%",
                          left: 8,
                          transform: "translateY(-50%)",
                          backgroundColor: "rgba(0,0,0,0.5)",
                          color: "#fff",
                        }}>
                        <ChevronLeftIcon fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() =>
                          handleImageChange(product._id, "next", images.length)
                        }
                        sx={{
                          position: "absolute",
                          top: "50%",
                          right: 8,
                          transform: "translateY(-50%)",
                          backgroundColor: "rgba(0,0,0,0.5)",
                          color: "#fff",
                        }}>
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Box>

                <CardContent sx={{ p: 2.25 }}>
                  <Typography fontWeight={600}>{product.name}</Typography>

                  <Typography variant="body2" color="text.secondary" mb={1}>
                    ₹{unitPrice} / {product.uom}
                    {/* Set by the admin for this territory, not the default */}
                    {product.priceSource === "location" && (
                      <Box
                        component="span"
                        sx={{
                          ml: 1,
                          px: 0.75,
                          py: 0.15,
                          borderRadius: 1,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--panel-green-ink, #047857)",
                          bgcolor: "var(--panel-green-tint, #ecfdf5)",
                          verticalAlign: "middle",
                        }}>
                        Location price
                      </Box>
                    )}
                  </Typography>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center">
                    <Typography fontWeight={700}>₹{totalPrice}</Typography>

                    <TextField
                      type="number"
                      size="small"
                      value={quantities[product._id] ?? ""}
                      onChange={(e) =>
                        handleQuantityChange(product._id, e.target.value)
                      }
                      inputProps={{ min: 0 }}
                      sx={{ width: 80 }}
                    />
                  </Box>
                </CardContent>

                <Button
                  fullWidth
                  onClick={() => handleAddToCart(product)}
                  sx={{
                    height: 56,
                    borderRadius: "0 0 12px 12px",
                    fontWeight: 700,
                    textTransform: "none",
                    backgroundColor: qty > 0 ? "#f59e0b" : "var(--panel-muted, #e5e7eb)",
                    color: qty > 0 ? "#fff" : "var(--panel-ink-muted, #6b7280)",
                  }}>
                  Add to cart
                </Button>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Pagination
        {...pager.controls}
        label="products"
        pageSizeOptions={[12, 24, 48]}
        className="mt-6 px-1"
      />
    </Box>
  );
};

export default ProductList;
