import { View, Text, Image, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { User, Lock, ShieldCheck, ChevronRight } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { loginSchema, type LoginForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordToggle } from "@/components/forms/PasswordToggle";
import { Button } from "@/components/ui/Button";
import { OrnateDivider } from "@/components/ui/OrnateDivider";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { agentId: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      await login(values.agentId.trim().toUpperCase(), values.password);
    } catch (error) {
      toast.error("Couldn't sign in", getErrorMessage(error, "Check your Agent ID and password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 450 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Image source={require("../../assets/images/logo.png")} style={{ width: 220, height: 149 }} resizeMode="contain" />
          </View>

          <View
            className="mt-6 rounded-[28px] border border-sand bg-white p-6"
            style={{ shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}
          >
            <Text className="font-display-bold text-2xl text-ink">Welcome back</Text>
            <Text className="mt-1 font-sans text-sm text-ink-500">Sign in with the Agent ID given by your admin.</Text>
            <OrnateDivider />

            <View>
              <FormInput
                control={control}
                name="agentId"
                label="Agent ID"
                required
                placeholder="BS2026-001"
                autoCapitalize="characters"
                autoCorrect={false}
                leftIcon={<User size={18} color={colors.ink[500]} />}
              />

              <FormInput
                control={control}
                name="password"
                label="Password"
                required
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                leftIcon={<Lock size={18} color={colors.ink[500]} />}
                rightSlot={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />

              <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={6} className="-mt-1 mb-5 self-end">
                <Text className="font-sans-bold text-sm text-saffron-700">Forgot password?</Text>
              </Pressable>

              <Button label="Sign In" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
            </View>

            <Pressable
              onPress={() => router.push("/(auth)/set-password")}
              className="mt-4 flex-row items-center gap-3 rounded-2xl bg-cream-100 p-3.5 active:opacity-80"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-100">
                <ShieldCheck size={17} color={colors.saffron[700]} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-ink">Recently approved?</Text>
                <Text className="font-sans text-xs text-ink-500">Set your password</Text>
              </View>
              <ChevronRight size={16} color={colors.ink[500]} />
            </Pressable>
          </View>

          <View className="mt-8 flex-row justify-center">
            <Text className="font-sans text-sm text-ink-500">Not an agent yet? </Text>
            <Pressable onPress={() => router.push("/(auth)/apply")} hitSlop={6}>
              <Text className="font-sans-bold text-sm text-saffron-700">Apply Now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
