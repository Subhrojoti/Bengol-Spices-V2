import { api } from "./client";
import { unwrapList, unwrapObject } from "./unwrap";
import type { Store, StoreType } from "@/types/api";

export interface CreateStoreInput {
  storeName: string;
  ownerName: string;
  phone: string;
  storeType: StoreType;
  state: string;
  city: string;
  street: string;
  pincode: string;
  latitude: number;
  longitude: number;
  imageUri: string;
}

export const storeApi = {
  getMyStores: (): Promise<Store[]> => api.get("/agent/store/my-stores").then((r) => unwrapList<Store>(r.data)),

  createStore: (input: CreateStoreInput): Promise<Store> => {
    const form = new FormData();
    form.append("storeName", input.storeName);
    form.append("ownerName", input.ownerName);
    form.append("phone", input.phone);
    form.append("storeType", input.storeType);
    form.append("state", input.state);
    form.append("city", input.city);
    form.append("street", input.street);
    form.append("pincode", input.pincode);
    form.append("latitude", String(input.latitude));
    form.append("longitude", String(input.longitude));

    const name = input.imageUri.split("/").pop() ?? "store.jpg";
    form.append("image", { uri: input.imageUri, name, type: "image/jpeg" } as unknown as Blob);

    return api
      .post("/agent/store/register", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => {
        const store = unwrapObject<Store>(r.data);
        if (!store) throw new Error("Unexpected response shape from /agent/store/register");
        return store;
      });
  },
};
