import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, KeyRound, MailCheck, Phone } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { forgotPasswordSchema, type ForgotPasswordForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { Button, IconButton } from "@/components/ui/Button";
import { OrnateDivider } from "@/components/ui/OrnateDivider";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

// Backend refuses to re-send a link for 60s after one was issued.
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [sentToPhone, setSentToPhone] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number>(0);

  const { control, handleSubmit, getValues } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { phone: "" },
  });

  const requestLink = async (phone: string) => {
    setSubmitting(true);
    try {
      await authApi.forgotPassword(phone);
      setSentToPhone(phone);
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      toast.success("Reset link sent", "Check the email registered with your account.");
    } catch (error) {
      toast.error("Couldn't send reset link", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (values: ForgotPasswordForm) => requestLink(values.phone.trim());

  const onResend = () => {
    if (Date.now() < resendAvailableAt) {
      const secondsLeft = Math.ceil((resendAvailableAt - Date.now()) / 1000);
      toast.info("Please wait", `You can request another link in ${secondsLeft}s.`);
      return;
    }
    return requestLink(getValues("phone").trim());
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
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
            {sentToPhone ? (
              <>
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
                  <MailCheck size={26} color={colors.saffron[600]} />
                </View>
                <Text className="mt-4 font-display-bold text-2xl text-ink">Check your email</Text>
                <Text className="mt-1 font-sans text-sm text-ink-500">
                  If {sentToPhone} is registered, we've sent a password reset link to the email on that account. The
                  link expires in 15 minutes.
                </Text>
                <OrnateDivider />

                <Text className="mb-4 font-sans text-sm text-ink-700">
                  Open the link on this phone to set a new password. If it doesn't open the app, copy the link from the
                  email and paste it on the next screen.
                </Text>

                <Button
                  label="I have my reset link"
                  onPress={() => router.push("/(auth)/reset-password")}
                  fullWidth
                  size="lg"
                />
                <Button
                  label="Resend link"
                  onPress={onResend}
                  loading={submitting}
                  variant="outline"
                  fullWidth
                  size="md"
                  className="mt-3"
                />
              </>
            ) : (
              <>
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
                  <KeyRound size={26} color={colors.saffron[600]} />
                </View>
                <Text className="mt-4 font-display-bold text-2xl text-ink">Forgot password?</Text>
                <Text className="mt-1 font-sans text-sm text-ink-500">
                  Enter your registered phone number and we'll email you a link to reset your password.
                </Text>
                <OrnateDivider />

                <FormInput
                  control={control}
                  name="phone"
                  label="Phone Number"
                  required
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                  leftIcon={<Phone size={18} color={colors.ink[500]} />}
                />

                <Button label="Send Reset Link" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
              </>
            )}
          </View>

          <View className="mt-8 flex-row justify-center">
            <Text className="font-sans text-sm text-ink-500">Remembered it? </Text>
            <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={6}>
              <Text className="font-sans-bold text-sm text-saffron-700">Back to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
