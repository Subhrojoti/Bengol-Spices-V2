import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Text, View, Modal, Pressable, ScrollView } from "react-native";
import { WebView } from "react-native-webview";
import { mapHtml, type MapDestination } from "./mapHtml";
import { leafletLicense } from "./vendor/leaflet";
export { type MapDestination } from "./mapHtml";
export function StoreMap({ points, onSelect, selectedId = "", appName = "BengolDelivery" }: { points: MapDestination[]; onSelect: (id: string) => void; selectedId?: string; appName?: string }) {
  const source = useMemo(() => ({ html: mapHtml(points), baseUrl: "https://bengolspices.com/mobile-map/" }), [points]);
  const view = useRef<WebView>(null);
  const focusScript = `window.focusStore?.(${JSON.stringify(selectedId)});true;`;
  useEffect(() => { view.current?.injectJavaScript(focusScript); }, [focusScript]);
  const [unavailable, setUnavailable] = useState(false);
  const [credits, setCredits] = useState(false);
  return <View className="flex-1 overflow-hidden rounded-2xl border border-sand"><WebView ref={view} source={source} onLoadEnd={() => view.current?.injectJavaScript(focusScript)} originWhitelist={["https://bengolspices.com"]} cacheEnabled cacheMode="LOAD_DEFAULT" userAgent={`${appName}/1.0 (+https://bengolspices.com)`} javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false} domStorageEnabled={false} allowFileAccess={false} geolocationEnabled={false} mixedContentMode="never" onShouldStartLoadWithRequest={request => {
    if (["about:blank", "https://bengolspices.com/mobile-map/"].includes(request.url)) return true;
    if (request.url === "https://www.openstreetmap.org/copyright") void Linking.openURL(request.url);
    return false;
  }} onMessage={event => { try { const value = JSON.parse(event.nativeEvent.data); if (value.type === "ready") view.current?.injectJavaScript(focusScript); else if (value.type === "select" && typeof value.id === "string" && points.some(point => point.id === value.id)) onSelect(value.id); else if (value.type === "tiles-unavailable") setUnavailable(true); } catch { /* ignore unexpected map messages */ } }} onError={() => setUnavailable(true)} style={{ flex: 1, minHeight: 180, backgroundColor: "#f4f0e8" }} />{unavailable && <View><Pressable accessibilityRole="button" onPress={() => { setUnavailable(false); view.current?.reload(); }}><Text className="bg-white px-3 py-2 font-sans-bold text-sm text-cardamom-700">Retry map</Text></Pressable><Text className="bg-white px-3 py-2 font-sans text-xs text-ink-500">Map tiles are unavailable. Store details and navigation links remain usable.</Text></View>}<Pressable accessibilityRole="button" onPress={() => setCredits(true)}><Text className="bg-white px-3 py-1 text-right font-sans text-xs text-cardamom-700">Map credits and licences</Text></Pressable><Modal visible={credits} onRequestClose={() => setCredits(false)} animationType="slide"><View className="flex-1 bg-white px-5 pb-5 pt-12"><Pressable accessibilityRole="button" onPress={() => setCredits(false)}><Text className="py-3 font-sans-bold text-base text-ink">Close map credits</Text></Pressable><ScrollView><Text className="font-sans-semibold text-sm text-ink">Map data: OpenStreetMap contributors (ODbL)</Text><Text onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")} className="my-3 font-sans text-sm text-cardamom-700">OpenStreetMap copyright and licence</Text><Text selectable className="font-sans text-xs leading-5 text-ink-700">{leafletLicense}</Text></ScrollView></View></Modal></View>;
}
