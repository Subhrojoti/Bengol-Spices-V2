import { View, Text, Image, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Phone, Lock, Eye, EyeOff } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { loginSchema, type LoginForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
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
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      await login(values.phone.trim(), values.password);
    } catch (error) {
      toast.error("Couldn't sign in", getErrorMessage(error, "Check your phone number and password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Image source={require("../../assets/images/logo.png")} style={{ width: 220, height: 145 }} resizeMode="contain" />
            <Text className="mt-1 font-sans-semibold text-xs uppercase tracking-[3px] text-saffron-700">
              Delivery Partner
            </Text>
          </View>

          <View
            className="mt-6 rounded-[28px] border border-sand bg-white p-6"
            style={{ shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}
          >
            <Text className="font-display-bold text-2xl text-ink">Welcome back</Text>
            <Text className="mt-1 font-sans text-sm text-ink-500">Sign in with your registered phone number.</Text>
            <OrnateDivider />

            <View>
              <FormInput
                control={control}
                name="phone"
                label="Phone Number"
                required
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                leftIcon={<Phone size={18} color={colors.ink[500]} />}
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
                rightSlot={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    {showPassword ? <EyeOff size={18} color={colors.ink[500]} /> : <Eye size={18} color={colors.ink[500]} />}
                  </Pressable>
                }
              />

              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                hitSlop={6}
                className="-mt-2 mb-5 self-end"
              >
                <Text className="font-sans-semibold text-sm text-saffron-700">Forgot password?</Text>
              </Pressable>

              <Button label="Sign In" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" />
            </View>
          </View>

          <View className="mt-8 flex-row justify-center">
            <Text className="font-sans text-sm text-ink-500">Not registered yet? </Text>
            <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={6}>
              <Text className="font-sans-bold text-sm text-saffron-700">Apply Now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
