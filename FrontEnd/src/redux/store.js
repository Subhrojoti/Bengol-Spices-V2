import { configureStore } from "@reduxjs/toolkit";
import addToCartSlice from "./slices/addToCart/addToCart";
import myStoresUiReducer from "./slices/myStoresUi/myStoresUi";

export const store = configureStore({
  reducer: {
    addToCart: addToCartSlice,
    myStoresUi: myStoresUiReducer,
  },
});
