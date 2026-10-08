import { z } from "zod";

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginForm = z.infer<typeof loginSchema>;

const strongPassword = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must contain letters and numbers");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
    email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
    password: strongPassword,
    idType: z.enum(["AADHAAR", "DRIVING_LICENSE"], { message: "Select an ID type" }),
    idNumber: z.string().trim().min(4, "Enter your ID number"),
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
export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
});
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    // Only filled in when the screen wasn't opened from the email link.
    resetLink: z.string().trim(),
    password: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
