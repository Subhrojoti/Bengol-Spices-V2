import { Modal, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutProps {
  visible: boolean;
  orderId: string;
  /** In paise, exactly as the backend's Razorpay order returns it. */
  amountInPaise: number;
  keyId: string;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onDismiss: () => void;
}

export function RazorpayCheckout({ visible, orderId, amountInPaise, keyId, onSuccess, onDismiss }: RazorpayCheckoutProps) {
  // 🔥 FIX: the session amount is already in paise (the backend passes on
  // Razorpay's own order.amount). Multiplying it by 100 again handed the
  // checkout 100× the real figure, which no longer matched the order.
  const html = `
    <!DOCTYPE html>
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
    <body>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script>
        const options = {
          key: "${keyId}",
          amount: ${Math.round(amountInPaise)},
          currency: "INR",
          name: "Bengol Spices",
          order_id: "${orderId}",
          handler: function (response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "success", ...response }));
          },
          modal: {
            ondismiss: function () {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: "dismiss" }));
            },
          },
          theme: { color: "#BE7326" },
        };
        const rzp = new Razorpay(options);
        rzp.open();
      </script>
    </body></html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "success") {
        onSuccess({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        });
      } else if (data.type === "dismiss") {
        onDismiss();
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1 }}>
        <WebView source={{ html }} onMessage={handleMessage} javaScriptEnabled domStorageEnabled />
      </View>
    </Modal>
  );
}
