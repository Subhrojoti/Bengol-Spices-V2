import { z } from "zod";

export const loginSchema = z.object({
  agentId: z.string().trim().min(1, "Enter your Agent ID"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginForm = z.infer<typeof loginSchema>;

const strongPassword = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must contain letters and numbers");

export const setPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Paste the link or token from your approval email"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SetPasswordForm = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your Agent ID or registered email"),
});
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Paste the reset link or token from your email"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const applyAgentSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
    address: z.string().trim().min(5, "Enter your full address"),
    state: z.string().trim().min(2, "Enter your state"),
    city: z.string().trim().min(2, "Enter your city"),
    street: z.string().trim().min(2, "Enter your street"),
    pincode: z.string().trim().regex(/^[0-9]{6}$/, "Enter a valid 6-digit pincode"),
    accountHolderName: z.string().trim().optional().or(z.literal("")),
    accountNumber: z.string().trim().optional().or(z.literal("")),
    ifscCode: z.string().trim().optional().or(z.literal("")),
    bankName: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const bankFields = [data.accountHolderName, data.accountNumber, data.ifscCode, data.bankName];
      const filled = bankFields.filter((f) => !!f).length;
      return filled === 0 || filled === 4;
    },
    { message: "Fill in all four bank fields, or leave all of them blank", path: ["bankName"] },
  );
export type ApplyAgentForm = z.infer<typeof applyAgentSchema>;

export const createStoreSchema = z.object({
  storeName: z.string().trim().min(2, "Enter the store name"),
  ownerName: z.string().trim().min(2, "Enter the owner's name"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
  storeType: z.enum(["RETAILER", "WHOLESALER", "DISTRIBUTOR", "HORECA"], { message: "Select a store type" }),
  state: z.string().trim().min(2, "Enter the state"),
  city: z.string().trim().min(2, "Enter the city"),
  street: z.string().trim().min(2, "Enter the street"),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "Enter a valid 6-digit pincode"),
});
export type CreateStoreForm = z.infer<typeof createStoreSchema>;

// 🔥 z.input<> (not z.infer<>/z.output<>) — z.coerce.number() has a
// different pre-coercion input type (unknown) than its post-coercion
// output type (number), and react-hook-form's useForm/SubmitHandler
// generics need to match the INPUT type for the zodResolver types to
// line up correctly. Verified fix — see conversation notes.
export const collectPaymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than ₹0"),
});
export type CollectPaymentForm = z.input<typeof collectPaymentSchema>;
