import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Eye, EyeOff, Link2, Lock, ShieldCheck } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { resetPasswordSchema, type ResetPasswordForm } from "@/utils/validators";
import { extractResetToken } from "@/utils/resetToken";
import { FormInput } from "@/components/forms/FormInput";
import { Button, IconButton } from "@/components/ui/Button";
import { OrnateDivider } from "@/components/ui/OrnateDivider";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

/**
 * Reached two ways:
 *  1. From the email link (deep link / universal link) with `?token=…` in the URL.
 *  2. From the forgot-password screen, in which case the user pastes the link.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenFromLink = extractResetToken(Array.isArray(params.token) ? params.token[0] : params.token);

  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { control, handleSubmit, setError } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { resetLink: "", password: "", confirmPassword: "" },
  });

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/login");
  };

  const onSubmit = async (values: ResetPasswordForm) => {
    const token = tokenFromLink ?? extractResetToken(values.resetLink);
    if (!token) {
      setError("resetLink", { message: "Paste the full reset link from your email" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      toast.success("Password updated", res.message || "You can now sign in with your new password.");
      router.replace("/(auth)/login");
    } catch (error) {
      toast.error("Couldn't reset password", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const eyeToggle = (shown: boolean, toggle: () => void) => (
    <Pressable onPress={toggle} hitSlop={8}>
      {shown ? <EyeOff size={18} color={colors.ink[500]} /> : <Eye size={18} color={colors.ink[500]} />}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={goBack} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="rounded-[28px] border border-sand bg-white p-6"
            style={{ shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}
          >
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
              <ShieldCheck size={26} color={colors.saffron[600]} />
            </View>
            <Text className="mt-4 font-display-bold text-2xl text-ink">Set a new password</Text>
            <Text className="mt-1 font-sans text-sm text-ink-500">
              {tokenFromLink
                ? "Choose a new password for your account. Reset links expire 15 minutes after they're sent."
                : "Paste the reset link from your email, then choose a new password."}
            </Text>
            <OrnateDivider />

            {tokenFromLink ? null : (
              <FormInput
                control={control}
                name="resetLink"
                label="Reset Link"
                required
                placeholder="Paste the link from your email"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                leftIcon={<Link2 size={18} color={colors.ink[500]} />}
              />
            )}

            <FormInput
              control={control}
              name="password"
              label="New Password"
              required
              placeholder="At least 6 characters, letters and numbers"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              leftIcon={<Lock size={18} color={colors.ink[500]} />}
              rightSlot={eyeToggle(showPassword, () => setShowPassword((v) => !v))}
            />

            <FormInput
              control={control}
              name="confirmPassword"
              label="Confirm New Password"
              required
              placeholder="Re-enter your new password"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              leftIcon={<Lock size={18} color={colors.ink[500]} />}
              rightSlot={eyeToggle(showConfirm, () => setShowConfirm((v) => !v))}
            />

            <Button label="Reset Password" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
          </View>

          <View className="mt-8 flex-row justify-center">
            <Text className="font-sans text-sm text-ink-500">Link expired? </Text>
            <Pressable onPress={() => router.replace("/(auth)/forgot-password")} hitSlop={6}>
              <Text className="font-sans-bold text-sm text-saffron-700">Request a new one</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
