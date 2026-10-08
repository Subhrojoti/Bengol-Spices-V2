import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Plus, Minus, Trash2, Search, X, PackageSearch, Wallet2, Landmark, QrCode as QrCodeIcon } from "lucide-react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
import { RazorpayCheckout, type RazorpaySuccessPayload } from "@/components/payments/RazorpayCheckout";
import { QrPaymentModal } from "@/components/payments/QrPaymentModal";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { useCatalog } from "@/hooks/useCatalog";
import { usePlaceOrder, useRefreshAfterOrderActivity } from "@/hooks/useOrders";
import { orderApi, type PlaceOrderInput } from "@/api/order.api";
import { formatCurrency } from "@/utils/currency";
import { isLocationPrice, resolveProductPrice } from "@/utils/pricing";
import { getErrorMessage, isSettledPaymentFailure } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import type { CartItem, PublicProduct, StoreType } from "@/types/api";

type PaymentMethod = "CASH" | "ONLINE" | "QR";

export default function CreateOrderScreen() {
  const { consumerId, storeName, storeType } = useLocalSearchParams<{ consumerId: string; storeName: string; storeType: StoreType }>();
  const router = useRouter();
  const refreshAfterOrderActivity = useRefreshAfterOrderActivity();
  const resolvedStoreType = (storeType ?? "RETAILER") as StoreType;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);

  const [razorpaySession, setRazorpaySession] = useState<{ razorpayOrderId: string; amount: number; key: string } | null>(null);
  const [razorpayVisible, setRazorpayVisible] = useState(false);

  const [qrSession, setQrSession] = useState<{ qrCodeId: string; imageUrl: string; amount: number } | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const placeOrder = usePlaceOrder();

  // Rounded to paise: a raw float sum (12.1 × 3 = 36.300000000000004) showed
  // up in the amount field and was sent as the amount paid.
  const cartTotal = useMemo(
    () => Math.round(cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100,
    [cart],
  );

  // 🔥 Partial payment at order creation — agent can collect any amount up
  // to the full total now, with the rest tracked as due for later
  // collection. Defaults to the full cart total, but editable. Resets
  // whenever the cart total changes so it doesn't get stuck at a stale
  // value from before items were added/removed.
  const [payNowText, setPayNowText] = useState(String(cartTotal));
  useEffect(() => {
    setPayNowText(String(cartTotal));
  }, [cartTotal]);

  const payNowAmount = useMemo(() => {
    const parsed = Math.round(Number(payNowText) * 100) / 100;
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, cartTotal);
  }, [payNowText, cartTotal]);

  const buildOrderPayload = (): PlaceOrderInput => ({
    consumerId,
    products: cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      uom: item.uom,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    paymentMode: method,
    paidAmount: payNowAmount,
  });

  const addToCart = (product: PublicProduct, quantity?: number) => {
    setCart((prev) => {
      if (prev.some((i) => i.productId === product._id)) return prev;
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          uom: product.uom,
          unitPrice: resolveProductPrice(product, resolvedStoreType),
          quantity: quantity ?? product.minOrderQty ?? 1,
          minOrderQty: product.minOrderQty || 1,
          image: product.images?.front?.url,
        },
      ];
    });
    setPickerOpen(false);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(item.minOrderQty, item.quantity + delta) } : item)),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleCashSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty", "Add at least one product first.");
      return;
    }
    if (payNowAmount <= 0) {
      toast.error("Enter an amount", "Enter how much is being paid now.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await placeOrder.mutateAsync(buildOrderPayload());
      toast.success("Order placed", result.orderId);
      router.push(`/orders/${result.orderId}`);
    } catch (e) {
      toast.error("Couldn't place order", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnlineSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty", "Add at least one product first.");
      return;
    }
    if (payNowAmount <= 0) {
      toast.error("Enter an amount", "Enter how much is being paid now.");
      return;
    }
    setSubmitting(true);
    try {
      const session = await orderApi.createInitialPayment(payNowAmount);
      setRazorpaySession(session);
      setRazorpayVisible(true);
    } catch (e) {
      toast.error("Couldn't start payment", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async (payload: RazorpaySuccessPayload) => {
    if (!razorpaySession) return;
    const amountPaidNow = payNowAmount;
    setRazorpayVisible(false);
    setSubmitting(true);
    try {
      const result = await orderApi.verifyInitialPaymentAndPlaceOrder({
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature,
        amount: razorpaySession.amount,
        orderPayload: buildOrderPayload(),
      });
      // 🔥 FIX: same paise/rupees display fix as Collect Payment — shows
      // the amount this screen itself already knows is in rupees, rather
      // than trusting whatever unit the backend's session response echoes.
      toast.success("Payment received", `${formatCurrency(amountPaidNow)} · Order ${result.orderId} placed`);
      refreshAfterOrderActivity();
      router.push(`/orders/${result.orderId}`);
    } catch (e) {
      toast.error("Couldn't place order", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 QR payment flow — agent generates a QR for the amount being paid
  // now (defaults to the full cart total, but editable for partial
  // payment), store owner scans and pays via their own UPI app. Verified
  // server-side against Razorpay before the order is placed.
  const handleGenerateQr = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty", "Add at least one product first.");
      return;
    }
    if (payNowAmount <= 0) {
      toast.error("Enter an amount", "Enter how much is being paid now.");
      return;
    }
    setSubmitting(true);
    try {
      const session = await orderApi.createInitialPaymentQr(payNowAmount);
      setQrSession(session);
      setQrVisible(true);
    } catch (e) {
      toast.error("Couldn't generate QR code", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Resolves whether the order was placed, so the QR modal can offer a retry
  // for a payment that was received but not yet recorded.
  const handleQrPaid = async (): Promise<boolean> => {
    if (!qrSession) return false;
    const amountPaidNow = payNowAmount;
    setSubmitting(true);
    try {
      const result = await orderApi.verifyQrAndPlaceOrder(qrSession.qrCodeId, qrSession.amount, buildOrderPayload());
      setQrVisible(false);
      toast.success("Payment received", `${formatCurrency(amountPaidNow)} · Order ${result.orderId} placed`);
      refreshAfterOrderActivity();
      router.push(`/orders/${result.orderId}`);
      return true;
    } catch (e) {
      toast.error("Couldn't place order", getErrorMessage(e));
      // Refunded, or passed to the office: a retry cannot place it, so close
      if (isSettledPaymentFailure(e)) {
        setQrVisible(false);
        return true;
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="ml-2 flex-1 font-display-bold text-xl text-ink" numberOfLines={1}>
          {storeName ?? "Create Order"}
        </Text>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        ListHeaderComponent={
          <Button label="Add Products" variant="outline" icon={<Plus size={16} color={colors.ink.DEFAULT} />} onPress={() => setPickerOpen(true)} fullWidth className="mb-2" />
        }
        ListEmptyComponent={<EmptyState icon={<PackageSearch size={22} color={colors.ink[500]} />} title="No products added yet" subtitle="Tap “Add Products” to build this order." />}
        renderItem={({ item }) => (
          <Card className="flex-row items-center gap-3">
            {item.image ? <Image source={{ uri: item.image }} className="h-12 w-12 rounded-lg" /> : <View className="h-12 w-12 rounded-lg bg-sand" />}
            <View className="flex-1">
              <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="font-sans text-xs text-ink-500">
                {formatCurrency(item.unitPrice)} / {item.uom}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full border border-sand-dark bg-white px-1.5 py-1">
              <Pressable onPress={() => updateQuantity(item.productId, -1)} className="h-7 w-7 items-center justify-center rounded-full bg-cream-100">
                <Minus size={14} color={colors.ink.DEFAULT} />
              </Pressable>
              <Text className="min-w-[24px] text-center font-sans-bold text-sm text-ink">{item.quantity}</Text>
              <Pressable onPress={() => updateQuantity(item.productId, 1)} className="h-7 w-7 items-center justify-center rounded-full bg-cream-100">
                <Plus size={14} color={colors.ink.DEFAULT} />
              </Pressable>
            </View>
            <Pressable onPress={() => removeFromCart(item.productId)} hitSlop={8}>
              <Trash2 size={16} color={colors.chili[600]} />
            </Pressable>
          </Card>
        )}
        ListFooterComponent={
          cart.length > 0 ? (
            <View className="mt-4">
              <View className="rounded-2xl border border-sand bg-white p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-sm text-ink-500">Order Total</Text>
                  <Text className="font-display-black text-2xl text-ink">{formatCurrency(cartTotal)}</Text>
                </View>
              </View>

              <View className="mt-4">
                <Input
                  label="Amount to Collect Now"
                  required
                  keyboardType="decimal-pad"
                  value={payNowText}
                  onChangeText={setPayNowText}
                  leftIcon={<Wallet2 size={16} color={colors.ink[500]} />}
                  hint={
                    payNowAmount > 0 && payNowAmount < cartTotal
                      ? `${formatCurrency(cartTotal - payNowAmount)} will be tracked as due for later collection.`
                      : "Defaults to the full order total — reduce it if the store owner is only paying part now."
                  }
                />
              </View>

              <View className="mt-1">
                <SegmentedControl<PaymentMethod>
                  segments={[
                    { value: "CASH", label: "Cash" },
                    { value: "ONLINE", label: "Online" },
                    { value: "QR", label: "QR" },
                  ]}
                  value={method}
                  onChange={setMethod}
                />
              </View>

              {method === "CASH" ? (
                <Button label="Place Order" icon={<Wallet2 size={16} color={colors.white} />} onPress={handleCashSubmit} loading={submitting} fullWidth size="lg" className="mt-4" />
              ) : method === "ONLINE" ? (
                <View className="mt-4">
                  <View className="mb-3 flex-row items-center gap-2.5 rounded-xl bg-saffron-50 p-3.5">
                    <Landmark size={18} color={colors.saffron[600]} />
                    <Text className="flex-1 font-sans text-xs text-ink-700">
                      For emergencies — you pay on the store owner's behalf using your own card/UPI.
                    </Text>
                  </View>
                  <Button label="Pay & Place Order" icon={<Landmark size={16} color={colors.white} />} onPress={handleOnlineSubmit} loading={submitting} fullWidth size="lg" />
                </View>
              ) : (
                <View className="mt-4">
                  <View className="mb-3 flex-row items-center gap-2.5 rounded-xl bg-saffron-50 p-3.5">
                    <QrCodeIcon size={18} color={colors.saffron[600]} />
                    <Text className="flex-1 font-sans text-xs text-ink-700">
                      The store owner scans this to pay {formatCurrency(payNowAmount)} directly via their own UPI app.
                    </Text>
                  </View>
                  <Button label="Generate QR Code" icon={<QrCodeIcon size={16} color={colors.white} />} onPress={handleGenerateQr} loading={submitting} fullWidth size="lg" />
                </View>
              )}
            </View>
          ) : null
        }
      />

      <ProductPickerModal
        consumerId={consumerId}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        storeType={resolvedStoreType}
        excludeIds={cart.map((i) => i.productId)}
        onSelect={addToCart}
      />

      {razorpaySession ? (
        <RazorpayCheckout
          visible={razorpayVisible}
          orderId={razorpaySession.razorpayOrderId}
          amountInPaise={razorpaySession.amount}
          keyId={razorpaySession.key}
          onSuccess={handleRazorpaySuccess}
          onDismiss={() => setRazorpayVisible(false)}
        />
      ) : null}

      <QrPaymentModal
        visible={qrVisible}
        qrCodeId={qrSession?.qrCodeId ?? null}
        imageUrl={qrSession?.imageUrl ?? null}
        amount={qrSession?.amount ?? 0}
        subtitle="For this order"
        onClose={() => setQrVisible(false)}
        onPaid={handleQrPaid}
      />
    </SafeAreaView>
  );
}

function ProductPickerModal({
  visible,
  onClose,
  consumerId,
  storeType,
  excludeIds,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  consumerId: string;
  storeType: StoreType;
  excludeIds: string[];
  onSelect: (product: PublicProduct, quantity?: number) => void;
}) {
  // Priced for this store, so a location price the admin set shows here and
  // matches what the server charges
  const { data: products, isLoading, isError, error, refetch } = useCatalog(consumerId);
  const [query, setQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<PublicProduct | null>(null);

  const filtered = useMemo(() => {
    const list = (products ?? []).filter((p) => !excludeIds.includes(p._id));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, excludeIds, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 pt-3">
          <Text className="font-display-bold text-xl text-ink">Add Products</Text>
          <IconButton onPress={onClose} className="bg-white">
            <X size={18} color={colors.ink.DEFAULT} />
          </IconButton>
        </View>

        <View className="px-5 pt-3">
          <Input placeholder="Search products…" value={query} onChangeText={setQuery} leftIcon={<Search size={16} color={colors.ink[500]} />} />
        </View>

        {isLoading ? (
          <LoadingState message="Loading products…" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load products.")} onRetry={refetch} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
            ListEmptyComponent={<EmptyState icon={<PackageSearch size={22} color={colors.ink[500]} />} title="No products found" />}
            renderItem={({ item }) => (
              <ProductPickerRow item={item} storeType={storeType} onSelect={() => onSelect(item)} onOpenDetail={() => setDetailProduct(item)} />
            )}
          />
        )}
      </SafeAreaView>

      <ProductDetailModal
        visible={!!detailProduct}
        product={detailProduct}
        storeType={storeType}
        onClose={() => setDetailProduct(null)}
        onAdd={(product, quantity) => {
          setDetailProduct(null);
          onSelect(product, quantity);
        }}
      />
    </Modal>
  );
}

function ProductPickerRow({
  item,
  storeType,
  onSelect,
  onOpenDetail,
}: {
  item: PublicProduct;
  storeType: StoreType;
  onSelect: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <Pressable onPress={onOpenDetail} className="rounded-2xl border border-sand bg-white p-3 active:opacity-90">
      <View className="flex-row items-center gap-3">
        {item.images?.front?.url ? <Image source={{ uri: item.images.front.url }} className="h-12 w-12 rounded-lg" /> : <View className="h-12 w-12 rounded-lg bg-sand" />}
        <View className="flex-1">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="font-sans text-xs text-ink-500">
            {formatCurrency(resolveProductPrice(item, storeType))} / {item.uom} · Min {item.minOrderQty}
            {isLocationPrice(item, storeType) ? " · Location price" : ""}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full bg-saffron-50"
        >
          <Plus size={16} color={colors.saffron[600]} />
        </Pressable>
      </View>
      <Text className="mt-1.5 font-sans-medium text-[10px] text-saffron-700">Tap for details</Text>
    </Pressable>
  );
}
