import { useEffect, useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, KeyRound, MailCheck, User, LockKeyhole } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { forgotPasswordSchema, type ForgotPasswordForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

// The backend won't send another reset email within a minute of the last
// one, so the Resend button counts down the same window instead of
// silently doing nothing.
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { control, handleSubmit, getValues } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const requestReset = async (identifier: string) => {
    setSubmitting(true);
    try {
      await authApi.forgotPassword(identifier);
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      toast.error("Couldn't send reset link", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (values: ForgotPasswordForm) => requestReset(values.identifier);
  const onResend = () => requestReset(getValues("identifier"));
  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={backToLogin} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 400 }} keyboardShouldPersistTaps="handled">
          {sent ? (
            <>
              <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-cardamom-100">
                <MailCheck size={26} color={colors.cardamom[600]} />
              </View>
              <Text className="mt-4 font-display-bold text-2xl text-ink">Check your email</Text>
              <Text className="mt-1 font-sans text-sm leading-5 text-ink-500">
                If an account matches <Text className="font-sans-bold text-ink">{getValues("identifier").trim()}</Text>, we've sent a
                password reset link to its registered email. The link works for 15 minutes.
              </Text>

              <View className="mt-6 rounded-2xl border border-sand bg-white p-4">
                <StepRow step={1} text="Open the email from Bengol Spices." />
                <StepRow step={2} text="Copy the reset link (or just the token in it)." />
                <StepRow step={3} text="Come back here and paste it on the next screen." last />
              </View>

              <Button
                label="I have the link"
                icon={<LockKeyhole size={16} color={colors.white} />}
                onPress={() => router.push("/(auth)/reset-password")}
                fullWidth
                size="lg"
                className="mt-6"
              />
              <Button
                label={cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
                variant="outline"
                onPress={onResend}
                disabled={cooldown > 0}
                loading={submitting}
                fullWidth
                className="mt-3"
              />
            </>
          ) : (
            <>
              <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
                <KeyRound size={26} color={colors.saffron[600]} />
              </View>
              <Text className="mt-4 font-display-bold text-2xl text-ink">Forgot your password?</Text>
              <Text className="mt-1 font-sans text-sm leading-5 text-ink-500">
                Enter your Agent ID or the email you registered with. We'll send a link to choose a new password.
              </Text>

              <View className="mt-6">
                <FormInput
                  control={control}
                  name="identifier"
                  label="Agent ID or Email"
                  required
                  placeholder="BS2026-001 or you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  leftIcon={<User size={18} color={colors.ink[500]} />}
                />
                <Button label="Send Reset Link" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
              </View>
            </>
          )}

          <View className="mt-6 flex-row justify-center">
            <Text className="font-sans text-sm text-ink-500">Remembered it? </Text>
            <Pressable onPress={backToLogin} hitSlop={6}>
              <Text className="font-sans-bold text-sm text-saffron-700">Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepRow({ step, text, last }: { step: number; text: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 ${last ? "" : "mb-3"}`}>
      <View className="h-7 w-7 items-center justify-center rounded-full bg-saffron-50">
        <Text className="font-sans-bold text-xs text-saffron-700">{step}</Text>
      </View>
      <Text className="flex-1 font-sans text-sm text-ink-700">{text}</Text>
    </View>
  );
}
