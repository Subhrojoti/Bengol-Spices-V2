import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, UserPlus } from "lucide-react-native";
import { agentApi } from "@/api/agent.api";
import { authApi } from "@/api/auth.api";
import { applyAgentSchema, type ApplyAgentForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { ImagePickerField } from "@/components/forms/ImagePickerField";
import { DocumentPickerField, type PickedDocument } from "@/components/forms/DocumentPickerField";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function ApplyAgentScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [aadhaar, setAadhaar] = useState<PickedDocument | null>(null);
  const [pan, setPan] = useState<PickedDocument | null>(null);
  const [docErrors, setDocErrors] = useState<{ photo?: string; aadhaar?: string; pan?: string }>({});

  const { control, handleSubmit } = useForm<ApplyAgentForm>({
    resolver: zodResolver(applyAgentSchema),
    defaultValues: {
      name: "", email: "", phone: "", address: "", state: "", city: "", street: "", pincode: "",
      accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "",
    },
  });

  const onSubmit = async (values: ApplyAgentForm) => {
    const errors: typeof docErrors = {};
    if (!photoUri) errors.photo = "Upload a profile photo";
    if (!aadhaar) errors.aadhaar = "Upload your Aadhaar";
    if (!pan) errors.pan = "Upload your PAN";
    setDocErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Missing documents", "Upload your photo, Aadhaar, and PAN to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.applyAgent({
        ...values,
        accountHolderName: values.accountHolderName || undefined,
        accountNumber: values.accountNumber || undefined,
        ifscCode: values.ifscCode || undefined,
        bankName: values.bankName || undefined,
        photoUri: photoUri as string,
        aadhaar: aadhaar as PickedDocument,
        pan: pan as PickedDocument,
      });
      toast.success("Application submitted", `Reference: ${result.agentId}. We'll email you once approved.`);
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 480 }} keyboardShouldPersistTaps="handled">
          <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50">
            <UserPlus size={26} color={colors.saffron[600]} />
          </View>
          <Text className="mt-4 font-display-bold text-2xl text-ink">Apply to become an Agent</Text>
          <Text className="mt-1 font-sans text-sm text-ink-500">
            Fill in your details below. Our team reviews every application — you'll get an email once you're
            approved, with a link to set your password.
          </Text>

          <Text className="mb-2 mt-6 font-sans-bold text-sm text-ink">Personal Details</Text>
          <FormInput control={control} name="name" label="Full Name" required placeholder="Your full name" />
          <FormInput control={control} name="email" label="Email" required placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <FormInput control={control} name="phone" label="Phone Number" required placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />
          <FormInput control={control} name="address" label="Address" required placeholder="Full address" />

          <Text className="mb-2 mt-2 font-sans-bold text-sm text-ink">Location</Text>
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

          <Text className="mb-2 mt-2 font-sans-bold text-sm text-ink">Documents</Text>
          <ImagePickerField label="Profile Photo" uri={photoUri} onChange={setPhotoUri} error={docErrors.photo} />
          <DocumentPickerField label="Aadhaar" hint="PDF or image" value={aadhaar} onChange={setAadhaar} error={docErrors.aadhaar} />
          <DocumentPickerField label="PAN" hint="PDF or image" value={pan} onChange={setPan} error={docErrors.pan} />

          <Button label="Submit Application" onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" className="mt-4" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
