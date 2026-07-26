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
import { fetchProducts } from "../../../../../api/services";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../../../../redux/slices/addToCart/addToCart";
import { setLeftView } from "../../../../../redux/slices/myStoresUi/myStoresUi";

const ProductList = ({ onBack }) => {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [imageIndex, setImageIndex] = useState({});

  const selectedStore = useSelector((state) => state.myStoresUi.selectedStore);

  const dispatch = useDispatch();

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

  const consumerId = selectedStore.consumerId;
  const storeName = selectedStore.storeName;
  const storeType = selectedStore.storeType?.toUpperCase(); // 👈 extracted once

  const cartCount = useSelector((state) => {
    if (!consumerId) return 0;

    const items = state.addToCart.carts[consumerId]?.items || [];

    return items.length;
  });

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

  /* ---------------- API ---------------- */
  useEffect(() => {
    const loadProducts = async () => {
      const res = await fetchProducts();
      setProducts(res?.products || []);
    };

    loadProducts();
  }, []);

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
      <Grid container spacing={3} sx={{ paddingLeft: 3.5 }}>
        {products.map((product) => {
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
                    backgroundColor: qty > 0 ? "#f59e0b" : "#e5e7eb",
                    color: qty > 0 ? "#fff" : "#6b7280",
                  }}>
                  Add to cart
                </Button>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default ProductList;
