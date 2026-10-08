import { api } from "./client";
import type { PickedDocument } from "@/components/forms/DocumentPickerField";

export interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  idType: "AADHAAR" | "DRIVING_LICENSE";
  idNumber: string;
  state: string;
  city: string;
  street: string;
  pincode: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  document: PickedDocument;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export const authApi = {
  login: (phone: string, password: string) =>
    api.post<{ success: true; token: string }>("/delivery-partner/login", { phone, password }).then((r) => r.data),

  /** Tells the server this session is over. The token is passed in, because
   * by the time this is sent it has already been removed from the phone. */
  logout: (token: string) =>
    api
      .post<{ success: true }>("/delivery-partner/logout", undefined, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data),

  /** Emails a one-time reset link (valid 15 min) to the email on the account. */
  forgotPassword: (phone: string) =>
    api
      .post<{ success: true; message: string }>("/auth/delivery-partner/forgot-password", { phone })
      .then((r) => r.data),

  /** Sets a new password using the token from the reset email. */
  resetPassword: (input: ResetPasswordInput) =>
    api
      .post<{ success: true; message: string }>("/auth/delivery-partner/reset-password", input)
      .then((r) => r.data),

  register: (input: RegisterInput) => {
    const form = new FormData();
    form.append("name", input.name);
    form.append("phone", input.phone);
    if (input.email) form.append("email", input.email);
    form.append("password", input.password);
    form.append("idType", input.idType);
    form.append("idNumber", input.idNumber);
    form.append("state", input.state);
    form.append("city", input.city);
    form.append("street", input.street);
    form.append("pincode", input.pincode);
    if (input.accountHolderName) form.append("accountHolderName", input.accountHolderName);
    if (input.accountNumber) form.append("accountNumber", input.accountNumber);
    if (input.ifscCode) form.append("ifscCode", input.ifscCode);
    if (input.bankName) form.append("bankName", input.bankName);

    form.append("document", {
      uri: input.document.uri,
      name: input.document.name,
      type: input.document.mimeType,
    } as unknown as Blob);

    return api
      .post<{ success: true; message: string }>("/delivery-partner/register", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
