import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, UserPlus } from "lucide-react-native";
import { authApi } from "@/api/auth.api";
import { registerSchema, type RegisterForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { RadioGroup } from "@/components/forms/RadioGroup";
import { DocumentPickerField, type PickedDocument } from "@/components/forms/DocumentPickerField";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function RegisterScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [docError, setDocError] = useState<string | undefined>();

  const { control, handleSubmit } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      idNumber: "",
      state: "",
      city: "",
      street: "",
      pincode: "",
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      bankName: "",
    },
  });

  const onSubmit = async (values: RegisterForm) => {
    if (!document) {
      setDocError("Upload your ID document");
      toast.error("Missing document", "Upload your Aadhaar or Driving License to continue.");
      return;
    }
    setDocError(undefined);

    setSubmitting(true);
    try {
      await authApi.register({
        ...values,
        email: values.email || undefined,
        accountHolderName: values.accountHolderName || undefined,
        accountNumber: values.accountNumber || undefined,
        ifscCode: values.ifscCode || undefined,
        bankName: values.bankName || undefined,
        document,
      });
      toast.success("Application submitted", "We'll notify you once your account is approved.");
      router.replace("/(auth)/login");
    } catch (error) {
      toast.error("Couldn't submit application", getErrorMessage(error));
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
            <UserPlus size={26} color={colors.saffron[600]} />
          </View>
          <Text className="mt-4 font-display-bold text-2xl text-ink">Apply as a Delivery Partner</Text>
          <Text className="mt-1 font-sans text-sm text-ink-500">
            Fill in your details below. Our team reviews every application before you can log in.
          </Text>

          <Text className="mb-2 mt-6 font-sans-bold text-sm text-ink">Personal Details</Text>
          <FormInput control={control} name="name" label="Full Name" required placeholder="Your full name" />
          <FormInput control={control} name="phone" label="Phone Number" required placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />
          <FormInput control={control} name="email" label="Email (optional)" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <FormInput control={control} name="password" label="Password" required placeholder="At least 6 characters" secureTextEntry autoCapitalize="none" />

          <Text className="mb-2 mt-2 font-sans-bold text-sm text-ink">Identity</Text>
          <Controller
            control={control}
            name="idType"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <RadioGroup
                label="ID Type"
                value={value}
                onChange={onChange}
                error={error?.message}
                options={[
                  { value: "AADHAAR", label: "Aadhaar" },
                  { value: "DRIVING_LICENSE", label: "Driving License" },
                ]}
              />
            )}
          />
          <FormInput control={control} name="idNumber" label="ID Number" required placeholder="Enter your ID number" />
          <DocumentPickerField label="ID Document" hint="PDF or image" value={document} onChange={setDocument} error={docError} />

          <Text className="mb-2 mt-2 font-sans-bold text-sm text-ink">Address</Text>
          <FormInput control={control} name="state" label="State" required placeholder="e.g. WEST BENGAL" autoCapitalize="characters" />
          <FormInput control={control} name="city" label="City" required placeholder="e.g. Kolkata" />
          <FormInput control={control} name="street" label="Street" required placeholder="e.g. Kancha Road" />
          <FormInput control={control} name="pincode" label="Pincode" required placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} />

          <Text className="mb-2 mt-2 font-sans-bold text-sm text-ink">Bank Details (optional)</Text>
          <Text className="mb-3 -mt-1 font-sans text-xs text-ink-500">If you fill in any one field here, all four are required.</Text>
          <FormInput control={control} name="accountHolderName" label="Account Holder Name" placeholder="As per bank records" />
          <FormInput control={control} name="accountNumber" label="Account Number" placeholder="Bank account number" keyboardType="number-pad" />
          <FormInput control={control} name="ifscCode" label="IFSC Code" placeholder="e.g. SBIN0001234" autoCapitalize="characters" />
          <FormInput control={control} name="bankName" label="Bank Name" placeholder="e.g. State Bank of India" />

          <Button label="Submit Application" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" className="mt-4" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
