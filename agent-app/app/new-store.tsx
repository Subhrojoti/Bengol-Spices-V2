import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Controller } from "react-hook-form";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsFocused, useRouter } from "expo-router";
import { ChevronLeft, MapPin, Store as StoreIcon } from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateStore } from "@/hooks/useStores";
import { storeApi } from "@/api/store.api";
import { useLocationCapture } from "@/hooks/useLocationCapture";
import { createStoreSchema, type CreateStoreForm } from "@/utils/validators";
import { FormInput } from "@/components/forms/FormInput";
import { RadioGroup } from "@/components/forms/RadioGroup";
import { ImagePickerField } from "@/components/forms/ImagePickerField";
import { Button, IconButton } from "@/components/ui/Button";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import { ChoiceField } from "@/components/forms/ChoiceField";
import { addressDefaults, coverageChoices, coverageState } from "@/utils/coverageChoices";

/* A screen of its own over the tabs, like an order or the profile, opened
   from Home's "Add Store" and from the Stores tab. It used to sit inside the
   Stores tab: opened from Home, it became the only screen in that tab, so
   Back went to Home and the Stores tab was left on this form, with no way
   back to the store list until the app was restarted. */
export default function CreateStoreScreen() {
  const router = useRouter();
  // Opened from a link there is nothing behind it: the store list instead
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/stores"));
  const createStore = useCreateStore();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const coverage = useQuery({ queryKey: ["sales-coverage", "mine"], queryFn: ({ signal }) => storeApi.getMyCoverage(signal), enabled: focused, retry: false });
  const areas = useMemo(() => coverage.isError ? [] : coverageChoices(coverage.data ?? []), [coverage.data, coverage.isError]);
  const defaultedAddress = useRef(false);
  const { captureLocation, capturing } = useLocationCapture();
  const [submitting, setSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number; capturedAt: number } | null>(null);
  const photoTakenAt = useRef(0);
  const [imageError, setImageError] = useState<string | undefined>();
  const [locationError, setLocationError] = useState<string | undefined>();

  const { control, handleSubmit, setValue, getValues, watch } = useForm<CreateStoreForm>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: { storeName: "", ownerName: "", phone: "", state: "", city: "", street: "", pincode: "", gstNumber: "" },
  });
  const state = watch("state");
  const area = areas.find(choice => choice.state === coverageState(state || ""));
  useEffect(() => {
    if (!coverage.isSuccess || defaultedAddress.current) return;
    defaultedAddress.current = true;
    if (areas.length !== 1 || getValues("state").trim()) return;
    setValue("state", areas[0].state);
    const defaults = addressDefaults(areas[0]);
    // Do not replace anything the agent typed while choices were loading.
    if (!getValues("city").trim()) setValue("city", defaults.city);
    if (!getValues("pincode").trim()) setValue("pincode", defaults.pincode);
  }, [coverage.isSuccess, areas, getValues, setValue]);

  const selectState = (next: string) => {
    if (coverageState(next) === coverageState(getValues("state"))) { setValue("state", next, { shouldValidate: true }); return; }
    const defaults = addressDefaults(areas.find(choice => choice.state === next));
    setValue("state", next, { shouldDirty: true, shouldValidate: true });
    setValue("city", defaults.city, { shouldDirty: true, shouldValidate: true });
    setValue("pincode", defaults.pincode, { shouldDirty: true, shouldValidate: true });
  };

  const handleCaptureLocation = async () => {
    if (!photoTakenAt.current) { setLocationError("Take the store photo first, then capture its location."); return; }
    const photo = photoTakenAt.current;
    setLocation(null);
    const result = await captureLocation();
    if (photo !== photoTakenAt.current) return;
    if (result.ok) {
      setLocation({ latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy, capturedAt: result.capturedAt });
      setLocationError(undefined);
    } else if (result.reason === "permission") {
      setLocationError("Location permission is off — allow it for this app in Settings, then try again.");
    } else if (result.reason === "mocked") {
      setLocationError("A fake-location (mock GPS) app is active on this phone. Turn it off, then capture the location again at the store.");
    } else if (result.reason === "imprecise") {
      const km = result.accuracy >= 1000 ? `${(result.accuracy / 1000).toFixed(1)} km` : `${result.accuracy} m`;
      setLocationError(
        `GPS accuracy is ${km}; 50 m or better is required. Allow precise location, step outside if indoors, then retry.`,
      );
    } else if (result.reason === "timeout") {
      setLocationError("Your phone took too long to find its location. Step outside or near a window, wait a few seconds, then try again.");
    } else {
      setLocationError("Couldn't get your location — turn on location (GPS) on the phone and try again.");
    }
  };

  const photoCaptured = (uri: string) => {
    photoTakenAt.current = Date.now();
    setImageUri(uri); setImageError(undefined); setLocation(null);
    void handleCaptureLocation();
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
    if (location && Date.now() - location.capturedAt > 120000) {
      setLocation(null); setLocationError("GPS reading expired. Capture the location again before submitting."); hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      await createStore.mutateAsync({
        ...values,
        latitude: location!.latitude,
        longitude: location!.longitude,
        locationAccuracy: location!.accuracy,
        locationCapturedAt: location!.capturedAt,
        photoTakenAt: photoTakenAt.current,
        imageUri: imageUri!,
      });
      toast.success("Store created");
      close();
    } catch (e) {
      /* On a weak signal the phone can send the form a second time by
         itself; the first copy registers the store and the second is
         refused ("already registered with this phone"), or the answer to
         the first never arrives. Look before reporting a failure. */
      const phone = values.phone.trim();
      const registered = await storeApi
        .getMyStores()
        .then((stores) => stores.some((s) => s.phone === phone && s.storeName === values.storeName.trim()))
        .catch(() => false);
      if (registered) {
        ["stores", "dashboard", "targets"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        toast.success("Store created");
        close();
        return;
      }
      toast.error("Couldn't create store", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={close} className="bg-white">
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
                  { value: "HORECA", label: "HoReCa" },
                ]}
              />
            )}
          />

          {coverage.isPending && <Text className="mb-3 font-sans text-xs text-ink-500">Loading your assigned address choices…</Text>}
          {coverage.isError && <View className="mb-4 gap-2"><Text className="font-sans text-xs text-ink-500">Assigned choices couldn't load. You can enter the address manually.</Text><Button label="Retry address choices" size="sm" variant="outline" onPress={() => coverage.refetch()} loading={coverage.isFetching} /></View>}
          {coverage.isSuccess && !areas.length && <Text className="mb-3 font-sans text-xs text-ink-500">No assigned pincodes found. Ask Admin to check your sales coverage before registration.</Text>}
          {areas.length ? <Controller control={control} name="state" render={({ field, fieldState }) => <ChoiceField label="State" value={field.value} options={areas.map(choice => choice.state)} onChange={selectState} onBlur={field.onBlur} error={fieldState.error?.message} disabled={submitting} />} /> : <FormInput control={control} name="state" label="State" required placeholder="e.g. WEST BENGAL" autoCapitalize="characters" />}
          {area?.cities.length ? <Controller control={control} name="city" render={({ field, fieldState }) => <ChoiceField label="City" value={field.value} options={area.cities} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} allowCustom disabled={submitting} />} /> : <FormInput control={control} name="city" label="City" required placeholder="e.g. Kolkata" />}
          <FormInput control={control} name="street" label="Street" required placeholder="e.g. Kancha Road" />
          {area?.pincodes.length ? <Controller control={control} name="pincode" render={({ field, fieldState }) => <ChoiceField label="Pincode" value={field.value} options={area.pincodes} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabled={submitting} />} /> : <FormInput control={control} name="pincode" label="Pincode" required placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} />}
          <FormInput control={control} name="gstNumber" label="GST Number (optional)" placeholder="15-character GSTIN" autoCapitalize="characters" maxLength={15} />

          <ImagePickerField label="Store Photo" uri={imageUri} onChange={photoCaptured} error={imageError} mode="camera" />

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
          {location && <Text className="mb-3 font-sans text-xs text-cardamom-700">GPS accuracy: {Math.ceil(location.accuracy)} m · within the required 50 m.</Text>}

          <Button label="Create Store" icon={<StoreIcon size={16} color={colors.white} />} onPress={handleSubmit(onSubmit)} disabled={capturing} loading={submitting} fullWidth size="lg" className="mt-4" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
