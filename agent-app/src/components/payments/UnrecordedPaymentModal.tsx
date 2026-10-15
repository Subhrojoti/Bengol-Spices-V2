import { View, Text, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RotateCw, TriangleAlert } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/utils/currency";
import { colors } from "@/theme/colors";

interface UnrecordedPaymentModalProps {
  visible: boolean;
  /** Rupees, as the agent saw it on the screen they paid from. */
  amount: number;
  /** Razorpay's own reference for the payment: what the office looks it up by. */
  reference: string;
  /** What is still to be done with the money, e.g. "the order has not been placed". */
  pending: string;
  /** Why the last try failed, in the server's words or the app's. */
  problem?: string | null;
  busy: boolean;
  onRetry: () => void;
  /** Gives up on recording it from this phone. */
  onGiveUp: () => void;
}

/* An online payment that went through at Razorpay but has not reached the
   office's records: the confirmation was sent and no answer came back (a
   weak signal, usually), or the server said to try again.

   The app used to show a message and go back to the "Pay" button, and the
   only thing that button can do is take the money a second time. The same
   confirmation is sent again from here instead; the server records a
   payment once however many times it is told about it. */
export function UnrecordedPaymentModal({ visible, amount, reference, pending, problem, busy, onRetry, onGiveUp }: UnrecordedPaymentModalProps) {
  const confirmGiveUp = () => {
    if (busy) return;
    Alert.alert(
      "Close without recording?",
      `The payment has been taken. If you close this, give the office the payment reference (${reference}) so they can record it or refund it. Do not pay again for the same thing.`,
      [
        { text: "Keep trying", style: "cancel" },
        { text: "Close", style: "destructive", onPress: onGiveUp },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={confirmGiveUp}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-saffron-100">
            <TriangleAlert size={38} color={colors.saffron[700]} />
          </View>
          <Text className="mt-4 text-center font-display-bold text-xl text-ink">Payment received, not recorded yet</Text>
          <Text className="mt-2 text-center font-sans text-sm leading-5 text-ink-700">
            {formatCurrency(amount)} was paid, but {pending}. Do not pay again. Check your connection and try again here: the payment will not be taken a second time.
          </Text>

          {problem ? <Text className="mt-3 text-center font-sans text-xs leading-4 text-chili-600">{problem}</Text> : null}

          <View className="mt-4 w-full rounded-xl border border-sand bg-white px-4 py-3">
            <Text className="font-sans text-[11px] text-ink-500">Payment reference</Text>
            <Text selectable className="mt-0.5 font-sans-bold text-sm text-ink">
              {reference}
            </Text>
          </View>

          <Button label="Try again" icon={<RotateCw size={15} color={colors.white} />} onPress={onRetry} loading={busy} fullWidth size="lg" className="mt-5" />
          <Button label="Close" variant="ghost" onPress={confirmGiveUp} disabled={busy} fullWidth className="mt-2" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
