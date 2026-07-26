import { createSlice } from "@reduxjs/toolkit";

const myStoresUi = createSlice({
  name: "myStoresUi",
  initialState: {
    leftView: "LIST", // LIST | CREATE | CART | VIEW
    selectedStore: null,
  },
  reducers: {
    setLeftView: (state, action) => {
      state.leftView = action.payload;
    },
    setSelectedStore: (state, action) => {
      state.selectedStore = action.payload;
    },
  },
});

export const { setLeftView, setSelectedStore } = myStoresUi.actions;
export default myStoresUi.reducer;
