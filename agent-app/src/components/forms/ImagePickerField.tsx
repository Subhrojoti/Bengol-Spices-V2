import { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, CheckCircle2 } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { toast } from "@/utils/toast";

// The server refuses any upload over 5 MB
const MAX_BYTES = 5 * 1024 * 1024;

interface ImagePickerFieldProps {
  label: string;
  uri: string | null;
  onChange: (uri: string) => void;
  error?: string;
  /** "camera" forces a live photo (no gallery picker) — use for anything
   * needing proof it was taken on the spot, e.g. a store photo at
   * creation time. Defaults to "library" (existing behavior). */
  mode?: "camera" | "library";
}

export function ImagePickerField({ label, uri, onChange, error, mode = "library" }: ImagePickerFieldProps) {
  const [busy, setBusy] = useState(false);

  const accept = (asset: ImagePicker.ImagePickerAsset) => {
    // Said here rather than after the whole form has been filled in and sent
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      toast.error("Photo is too large", "Choose or take one under 5 MB.");
      return;
    }
    onChange(asset.uri);
  };

  const pick = async () => {
    setBusy(true);
    try {
      if (mode === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        // Tapping used to do nothing at all once the permission was refused
        if (!permission.granted) {
          toast.error("Camera permission is off", "Allow the camera for this app in Settings, then try again.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) accept(result.assets[0]);
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          toast.error("Photo access is off", "Allow photos for this app in Settings, then try again.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) accept(result.assets[0]);
      }
    } catch {
      // No camera app, or the picker could not open: say so instead of nothing
      toast.error("Couldn't open the camera or photos", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-sans-semibold text-sm text-ink-700">
        {label}
        <Text className="text-chili-600"> *</Text>
      </Text>
      <Pressable
        onPress={pick}
        disabled={busy}
        className={`flex-row items-center gap-3 rounded-xl border p-3.5 ${
          error ? "border-chili-600" : uri ? "border-cardamom-600 bg-cardamom-100" : "border-dashed border-sand-dark bg-white"
        }`}
      >
        {uri ? (
          <Image source={{ uri }} className="h-12 w-12 rounded-lg" />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-lg bg-saffron-50">
            <Camera size={18} color={colors.saffron[600]} />
          </View>
        )}
        <View className="flex-1">
          <Text className="font-sans-semibold text-sm text-ink">
            {uri ? "Photo taken" : mode === "camera" ? "Tap to take a photo" : "Tap to upload"}
          </Text>
        </View>
        {uri ? <CheckCircle2 size={18} color={colors.cardamom[600]} /> : null}
      </Pressable>
      {error ? <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{error}</Text> : null}
    </View>
  );
}
