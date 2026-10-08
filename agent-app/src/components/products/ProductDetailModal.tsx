import { useState } from "react";
import { View, Text, Image, Modal, Pressable, ScrollView, Dimensions } from "react-native";
import { X, Tag, Percent, Minus, Plus } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/utils/currency";
import { resolveProductPrice } from "@/utils/pricing";
import { unitForCounting } from "@/utils/uom";
import { htmlToText } from "@/utils/htmlToText";
import { colors } from "@/theme/colors";
import type { PublicProduct, StoreType } from "@/types/api";

const { width: screenWidth } = Dimensions.get("window");

interface ProductDetailModalProps {
  visible: boolean;
  product: PublicProduct | null;
  storeType: StoreType;
  onClose: () => void;
  onAdd: (product: PublicProduct, quantity: number) => void;
}

export function ProductDetailModal({ visible, product, storeType, onClose, onAdd }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  if (!product) return null;

  const images = [product.images?.front?.url, product.images?.back?.url].filter(Boolean) as string[];
  const price = resolveProductPrice(product, storeType);
  // Written as rich text in the admin panel; shown here as plain text
  const description = htmlToText(product.description);

  const handleAdd = () => {
    onAdd(product, quantity);
    setQuantity(1);
    setActiveImage(0);
  };

  const handleClose = () => {
    setQuantity(1);
    setActiveImage(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="relative">
            {images.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                    setActiveImage(idx);
                  }}
                >
                  {images.map((uri, idx) => (
                    <Image key={idx} source={{ uri }} style={{ width: screenWidth, height: 300 }} resizeMode="contain" />
                  ))}
                </ScrollView>
                {images.length > 1 ? (
                  <View className="flex-row justify-center gap-1.5 pb-2">
                    {images.map((_, idx) => (
                      <View key={idx} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: idx === activeImage ? colors.saffron[600] : colors.sand.dark }} />
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <View className="h-[300px] w-full items-center justify-center bg-sand" />
            )}

            <Pressable
              onPress={handleClose}
              className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full bg-white"
              style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}
            >
              <X size={18} color={colors.ink.DEFAULT} />
            </Pressable>
          </View>

          <View className="px-5 pt-4">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 font-display-bold text-xl text-ink">{product.name}</Text>
              <View className="flex-row items-center gap-1.5 rounded-full bg-cardamom-100 px-3 py-1">
                <View className="h-1.5 w-1.5 rounded-full bg-cardamom-600" />
                <Text className="font-sans-bold text-xs text-cardamom-700">In Stock</Text>
              </View>
            </View>
            <Text className="mt-1 font-sans-semibold text-sm text-ink-500">
              {formatCurrency(price)} / {product.uom} · Min {product.minOrderQty}
            </Text>

            <View className="mt-4 rounded-2xl border border-sand bg-white p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-50">
                  <Tag size={16} color={colors.saffron[600]} />
                </View>
                <View>
                  <Text className="font-sans text-xs text-ink-500">Category</Text>
                  <Text className="font-sans-bold text-sm text-ink">{product.category}</Text>
                </View>
              </View>
              <View className="my-3 h-px bg-sand" />
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-50">
                  <Percent size={16} color={colors.saffron[600]} />
                </View>
                <View>
                  <Text className="font-sans text-xs text-ink-500">GST</Text>
                  <Text className="font-sans-bold text-sm text-ink">{product.gstPercentage}% (included in price)</Text>
                </View>
              </View>
            </View>

            {description ? (
              <View className="mt-4">
                <Text className="font-display-bold text-sm text-saffron-700">Product Description</Text>
                <Text className="mt-1.5 font-sans text-sm leading-6 text-ink-700">{description}</Text>
              </View>
            ) : null}

            <View className="mt-6 flex-row items-center gap-3">
              <Text className="font-sans-semibold text-sm text-ink-700">Quantity ({unitForCounting(product.uom)})</Text>
            </View>
            <View className="mt-2 flex-row items-center gap-3">
              <View className="flex-row items-center gap-3 rounded-full border border-sand-dark bg-white px-2 py-1">
                <Pressable onPress={() => setQuantity((q) => Math.max(product.minOrderQty, q - 1))} className="h-9 w-9 items-center justify-center rounded-full bg-cream-100">
                  <Minus size={16} color={colors.ink.DEFAULT} />
                </Pressable>
                <Text className="min-w-[32px] text-center font-sans-bold text-base text-ink">{quantity}</Text>
                <Pressable onPress={() => setQuantity((q) => q + 1)} className="h-9 w-9 items-center justify-center rounded-full bg-cream-100">
                  <Plus size={16} color={colors.ink.DEFAULT} />
                </Pressable>
              </View>
              <Button label="Add Product" icon={<Plus size={16} color={colors.white} />} onPress={handleAdd} className="flex-1" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
