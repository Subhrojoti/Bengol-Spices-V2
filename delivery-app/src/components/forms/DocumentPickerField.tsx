import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileText, CheckCircle2 } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { toast } from "@/utils/toast";

// The server refuses any upload over 5 MB
const MAX_BYTES = 5 * 1024 * 1024;

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
}

interface DocumentPickerFieldProps {
  label: string;
  hint?: string;
  value: PickedDocument | null;
  onChange: (doc: PickedDocument) => void;
  error?: string;
}

export function DocumentPickerField({ label, hint, value, onChange, error }: DocumentPickerFieldProps) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        /* Said here, at the moment the file is chosen. It used to be found
           out only after the whole application had been filled in and sent. */
        if (asset.size && asset.size > MAX_BYTES) {
          toast.error(`${label} file is too large`, "Choose a file under 5 MB.");
          return;
        }
        onChange({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" });
      }
    } catch {
      toast.error("Couldn't open the file picker", "Please try again.");
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
          error ? "border-chili-600" : value ? "border-cardamom-600 bg-cardamom-100" : "border-dashed border-sand-dark bg-white"
        }`}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: value ? colors.cardamom[600] : colors.saffron[50] }}
        >
          {value ? (
            <CheckCircle2 size={16} color={colors.white} />
          ) : (
            <FileText size={16} color={colors.saffron[600]} />
          )}
        </View>
        <View className="flex-1">
          <Text className="font-sans-semibold text-sm text-ink" numberOfLines={1}>
            {value ? value.name : "Tap to upload"}
          </Text>
          {hint ? <Text className="font-sans text-xs text-ink-500">{hint}</Text> : null}
        </View>
      </Pressable>

      {error ? <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{error}</Text> : null}
    </View>
  );
}
