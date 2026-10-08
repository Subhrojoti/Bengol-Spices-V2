import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, KeyRound, Link2 } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { setPasswordSchema, type SetPasswordForm } from "@/utils/validators";
import { extractToken } from "@/utils/resetToken";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordToggle } from "@/components/forms/PasswordToggle";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function SetPasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { control, handleSubmit } = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SetPasswordForm) => {
    setSubmitting(true);
    try {
      await authApi.setPassword(extractToken(values.token), values.password);
      toast.success("Password set", "You can now sign in.");
      router.replace("/(auth)/login");
    } catch (error) {
      toast.error("Couldn't set password", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 400 }} keyboardShouldPersistTaps="handled">
          <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
            <KeyRound size={26} color={colors.saffron[600]} />
          </View>
          <Text className="mt-4 font-display-bold text-2xl text-ink">Set Your Password</Text>
          <Text className="mt-1 font-sans text-sm leading-5 text-ink-500">
            Paste the link from your approval email, or just the token in it, then choose a password.
          </Text>

          <View className="mt-6">
            <FormInput
              control={control}
              name="token"
              label="Approval link or token"
              required
              placeholder="Paste the link from the email"
              hint="Pasting the whole link is fine. We'll pick out the token."
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Link2 size={18} color={colors.ink[500]} />}
            />
            <FormInput
              control={control}
              name="password"
              label="New Password"
              required
              placeholder="At least 6 characters"
              hint="Use letters and numbers."
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              rightSlot={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
            <FormInput
              control={control}
              name="confirmPassword"
              label="Confirm Password"
              required
              placeholder="Re-enter your password"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              rightSlot={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
            />
            <Button label="Set Password" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
