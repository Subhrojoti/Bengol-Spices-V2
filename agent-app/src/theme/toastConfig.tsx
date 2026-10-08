import { View, Text } from "react-native";
import { CheckCircle2, XCircle, Info } from "lucide-react-native";
import type { ToastConfig } from "react-native-toast-message";
import { colors } from "@/theme/colors";

function ToastCard({ icon, iconBg, title, message }: { icon: React.ReactNode; iconBg: string; title?: string; message?: string }) {
  return (
    <View className="mx-5 w-[92%] flex-row items-start gap-3 rounded-2xl border border-sand bg-white p-4 shadow-lg">
      <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
        {icon}
      </View>
      <View className="flex-1">
        {title ? <Text className="font-sans-bold text-sm text-ink">{title}</Text> : null}
        {message ? <Text className="mt-0.5 font-sans text-xs text-ink-500">{message}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <ToastCard icon={<CheckCircle2 size={18} color={colors.cardamom[600]} />} iconBg={colors.cardamom[100]} title={text1} message={text2} />,
  error: ({ text1, text2 }) => <ToastCard icon={<XCircle size={18} color={colors.chili[600]} />} iconBg={colors.chili[100]} title={text1} message={text2} />,
  info: ({ text1, text2 }) => <ToastCard icon={<Info size={18} color={colors.saffron[600]} />} iconBg={colors.saffron[100]} title={text1} message={text2} />,
};
