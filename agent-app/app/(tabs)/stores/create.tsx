import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Controller } from "react-hook-form";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, MapPin, Store as StoreIcon } from "lucide-react-native";
import { useCreateStore } from "@/hooks/useStores";
import { useLocationCapture } from "@/hooks/useLocationCapture";
import { createStoreSchema, type CreateStoreForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { RadioGroup } from "@/components/forms/RadioGroup";
import { ImagePickerField } from "@/components/forms/ImagePickerField";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export default function CreateStoreScreen() {
  const router = useRouter();
  const createStore = useCreateStore();
  const { captureLocation, capturing } = useLocationCapture();
  const [submitting, setSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [imageError, setImageError] = useState<string | undefined>();
  const [locationError, setLocationError] = useState<string | undefined>();

  const { control, handleSubmit, setValue, watch } = useForm<CreateStoreForm>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: { storeName: "", ownerName: "", phone: "", state: "", city: "", street: "", pincode: "" },
  });

  const handleCaptureLocation = async () => {
    const result = await captureLocation();
    if (result.ok) {
      setLocation({ latitude: result.latitude, longitude: result.longitude });
      setLocationError(undefined);
    } else if (result.reason === "permission") {
      setLocationError("Location permission is off — allow it for this app in Settings, then try again.");
    } else {
      setLocationError("Couldn't get your location — turn on location (GPS) on the phone and try again.");
    }
  };

  const onSubmit = async (values: CreateStoreForm) => {
    let hasError = false;
    if (!imageUri) {
      setImageError("Upload a store photo");
      hasError = true;
    }
    if (!location) {
      setLocationError("Capture the store's location first");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      await createStore.mutateAsync({
        ...values,
        latitude: location!.latitude,
        longitude: location!.longitude,
        imageUri: imageUri!,
      });
      toast.success("Store created");
      router.back();
    } catch (e) {
      toast.error("Couldn't create store", getErrorMessage(e));
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
        <Text className="ml-2 font-display-bold text-xl text-ink">Create Store</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 450 }} keyboardShouldPersistTaps="handled">
          <FormInput control={control} name="storeName" label="Store Name" required placeholder="e.g. Pritam Store" />
          <FormInput control={control} name="ownerName" label="Owner Name" required placeholder="e.g. Pritam Ghosh" />
          <FormInput control={control} name="phone" label="Phone Number" required placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />

          <Controller
            control={control}
            name="storeType"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <RadioGroup
                label="Store Type"
                value={value}
                onChange={onChange}
                error={error?.message}
                options={[
                  { value: "RETAILER", label: "Retailer" },
                  { value: "WHOLESALER", label: "Wholesaler" },
                  { value: "DISTRIBUTOR", label: "Distributor" },
                ]}
              />
            )}
          />

          <FormInput control={control} name="state" label="State" required placeholder="e.g. WEST BENGAL" autoCapitalize="characters" />
          <FormInput control={control} name="city" label="City" required placeholder="e.g. Kolkata" />
          <FormInput control={control} name="street" label="Street" required placeholder="e.g. Kancha Road" />
          <FormInput control={control} name="pincode" label="Pincode" required placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} />

          <ImagePickerField label="Store Photo" uri={imageUri} onChange={setImageUri} error={imageError} mode="camera" />

          <Button
            label={location ? "Location Captured ✓" : capturing ? "Capturing…" : "Capture Store Location"}
            variant={location ? "secondary" : "outline"}
            icon={<MapPin size={16} color={location ? colors.white : colors.ink.DEFAULT} />}
            onPress={handleCaptureLocation}
            loading={capturing}
            fullWidth
            className="mb-1"
          />
          {locationError ? <Text className="mb-3 font-sans-medium text-xs text-chili-600">{locationError}</Text> : null}

          <Button label="Create Store" icon={<StoreIcon size={16} color={colors.white} />} onPress={handleSubmit(onSubmit)} loading={submitting} fullWidth size="lg" className="mt-4" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
