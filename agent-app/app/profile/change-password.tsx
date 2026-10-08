import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, KeyRound } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { changePasswordSchema, type ChangePasswordForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordToggle } from "@/components/forms/PasswordToggle";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { control, handleSubmit } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordForm) => {
    setSubmitting(true);
    try {
      await authApi.changePassword(values.oldPassword, values.newPassword, values.confirmPassword);
      toast.success("Password changed");
      router.back();
    } catch (error) {
      toast.error("Couldn't change password", getErrorMessage(error));
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
        <Text className="ml-2 font-display-bold text-xl text-ink">Change Password</Text>
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
          <Text className="mt-4 font-sans text-sm text-ink-500">Choose a strong new password with letters and numbers.</Text>

          <View className="mt-6">
            <FormInput
              control={control}
              name="oldPassword"
              label="Current Password"
              required
              secureTextEntry={!showOld}
              autoCapitalize="none"
              rightSlot={<PasswordToggle visible={showOld} onToggle={() => setShowOld((v) => !v)} />}
            />
            <FormInput
              control={control}
              name="newPassword"
              label="New Password"
              required
              placeholder="At least 6 characters"
              hint="Use letters and numbers."
              secureTextEntry={!showNew}
              autoCapitalize="none"
              rightSlot={<PasswordToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} />}
            />
            <FormInput
              control={control}
              name="confirmPassword"
              label="Confirm New Password"
              required
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              rightSlot={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
            />
            <Button label="Change Password" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
