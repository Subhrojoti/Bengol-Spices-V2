import { useEffect, useState } from "react";
import { View, Text, Image, Modal, Pressable } from "react-native";
import { Button } from "@/components/ui/Button";

export function StorePhotoViewer({ url, name }: { url?: string; name: string }) {
  const [open, setOpen] = useState(false), [failed, setFailed] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => { setFailed(false); setOpen(false); }, [url]);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return <View className="mt-3">
    <Pressable accessibilityRole="button" accessibilityLabel={`View photo of ${name}`} onPress={() => { setFailed(false); setOpen(true); }} className="overflow-hidden rounded-xl border border-sand bg-cream">
      <Image source={{ uri: url }} className="h-28 w-full" resizeMode="cover" />
      <Text className="px-3 py-2 font-sans-semibold text-xs text-cardamom-700">View store photo</Text>
    </Pressable>
    <Modal visible={open} onRequestClose={() => setOpen(false)} transparent animationType="fade">
      <View className="flex-1 bg-black/90 px-5 py-12">
        <Button label="Close photo" onPress={() => setOpen(false)} />
        <Text className="my-3 text-center font-sans-semibold text-sm text-white">{name}</Text>
        {failed ? <View className="flex-1 items-center justify-center gap-4"><Text accessibilityRole="alert" className="text-center font-sans text-sm text-white">Could not load the store photo. Check your connection and retry.</Text><Button label="Retry photo" onPress={() => { setFailed(false); setRevision(n => n + 1); }} /></View> : <Image key={`${url}:${revision}`} source={{ uri: url }} onError={() => setFailed(true)} style={{ flex: 1, width: "100%" }} resizeMode="contain" />}
      </View>
    </Modal>
  </View>;
}
