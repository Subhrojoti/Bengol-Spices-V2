import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { myStores } from "../../../../api/services";
import StoresList from "./SubComponents/StoresList";
import ProductList from "./SubComponents/ProductList";
import MyCart from "./SubComponents/MyCart";
import { useDispatch, useSelector } from "react-redux";
import {
  setLeftView,
  setSelectedStore,
} from "../../../../redux/slices/myStoresUi/myStoresUi";
import ViewOrders from "./SubComponents/ViewOrders";

const MyStoresBase = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const leftView = useSelector((state) => state.myStoresUi.leftView);
  const selectedStore = useSelector((state) => state.myStoresUi.selectedStore);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await myStores();
        setStores(response?.stores || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stores.length) {
    return (
      <Typography textAlign="center" mt={6}>
        No stores found.
      </Typography>
    );
  }

  return (
    <Box display="flex" height="90vh" overflow="hidden">
      {/* LEFT PANEL (SCROLLABLE) */}
      <Box
        flex={1}
        overflow="auto"
        sx={{
          borderRight: "1px solid #e5e7eb",
        }}>
        {leftView === "LIST" && (
          <StoresList
            stores={stores}
            selectedStore={selectedStore}
            onSelectStore={(store) => {
              dispatch(setSelectedStore(store));
            }}
            onViewOrders={(store) => {
              dispatch(setSelectedStore(store));
              dispatch(setLeftView("VIEW"));
            }}
            onCreateOrder={(store) => {
              dispatch(setLeftView("CREATE"));
            }}
          />
        )}

        {leftView === "CREATE" && (
          <ProductList onBack={() => dispatch(setLeftView("LIST"))} />
        )}

        {leftView === "CART" && (
          <MyCart onBack={() => dispatch(setLeftView("CREATE"))} />
        )}

        {leftView === "VIEW" && (
          <ViewOrders
            onBack={() => dispatch(setLeftView("LIST"))}
            onCreate={() => dispatch(setLeftView("CREATE"))}
          />
        )}
      </Box>
    </Box>
  );
};

export default MyStoresBase;
