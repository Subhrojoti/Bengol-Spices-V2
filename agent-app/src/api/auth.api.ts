import { api } from "./client";
import { tokenStorage } from "@/utils/tokenStorage";
import type { Agent } from "@/types/api";
import type { PickedDocument } from "@/components/forms/DocumentPickerField";

export interface ApplyAgentInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  city: string;
  street: string;
  pincode: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  photoUri: string;
  aadhaar: PickedDocument;
  pan: PickedDocument;
}

function appendFile(form: FormData, field: string, uri: string, name: string, mimeType: string) {
  form.append(field, { uri, name, type: mimeType } as unknown as Blob);
}

export const authApi = {
  login: (agentId: string, password: string) =>
    api.post<{ success: true; token: string; agent: Agent }>("/auth/agent/login", { agentId, password }).then((r) => r.data),

  /** Tells the server this session is over. The token is passed in, because
   * by the time this is sent it has already been removed from the phone. */
  logout: (token: string) =>
    api
      .post<{ success: true }>("/auth/logout", undefined, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  // The backend mounts this under the agent router: POST /agent/auth/set-password
  setPassword: (token: string, password: string) =>
    api.post<{ success: true; message: string }>("/agent/auth/set-password", { token, password }).then((r) => r.data),

  /** Accepts an Agent ID or a registered email. The backend always answers
   * with a generic message so accounts can't be enumerated. */
  forgotPassword: (identifier: string) => {
    const value = identifier.trim();
    const body = value.includes("@") ? { email: value.toLowerCase() } : { agentId: value.toUpperCase() };
    return api.post<{ success: true; message: string }>("/auth/agent/forgot-password", body).then((r) => r.data);
  },

  resetPassword: (token: string, password: string, confirmPassword: string) =>
    api
      .post<{ success: true; message: string }>("/auth/agent/reset-password", { token, password, confirmPassword })
      .then((r) => r.data),

  /** Changing the password signs out every other device. The backend hands
   * this one a fresh token in the same answer; it is kept here, or the very
   * next request would be refused and the agent thrown back to sign-in. */
  changePassword: (oldPassword: string, newPassword: string, confirmPassword: string) =>
    api
      .post<{ success: true; message: string; token?: string }>("/auth/change-password", { oldPassword, newPassword, confirmPassword })
      .then(async (r) => {
        if (r.data.token) await tokenStorage.set(r.data.token);
        return r.data;
      }),

  applyAgent: (input: ApplyAgentInput) => {
    const form = new FormData();
    form.append("name", input.name);
    form.append("email", input.email);
    form.append("phone", input.phone);
    form.append("address", input.address);
    form.append("state", input.state);
    form.append("city", input.city);
    form.append("street", input.street);
    form.append("pincode", input.pincode);
    if (input.accountHolderName) form.append("accountHolderName", input.accountHolderName);
    if (input.accountNumber) form.append("accountNumber", input.accountNumber);
    if (input.ifscCode) form.append("ifscCode", input.ifscCode);
    if (input.bankName) form.append("bankName", input.bankName);

    const photoName = input.photoUri.split("/").pop() ?? "photo.jpg";
    const photoExt = photoName.split(".").pop()?.toLowerCase();
    appendFile(form, "photo", input.photoUri, photoName, photoExt === "png" ? "image/png" : "image/jpeg");
    appendFile(form, "aadhaar", input.aadhaar.uri, input.aadhaar.name, input.aadhaar.mimeType);
    appendFile(form, "pan", input.pan.uri, input.pan.name, input.pan.mimeType);

    return api
      .post<{ success: true; message: string; agentId: string }>("/agent/apply", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
