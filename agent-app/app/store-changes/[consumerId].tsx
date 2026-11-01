import { useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { ImagePickerField } from "@/components/forms/ImagePickerField";
import { useMyStores } from "@/hooks/useStores";
import { useLocationCapture } from "@/hooks/useLocationCapture";
import { storeChangesApi } from "@/api/storeChanges.api";
import { getErrorMessage } from "@/api/client";
import { newRequestId } from "@/utils/requestId";
import { formatDateTime } from "@/utils/date";
import { toast } from "@/utils/toast";
import type { Store } from "@/types/api";
import { buildStoreCorrection, correctionValues, type CorrectionGps } from "@/utils/storeCorrection";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";

const labels: Record<string, string> = { storeName: "Store name", ownerName: "Owner name", phone: "Phone", gstNumber: "GST number", state: "State", city: "City", street: "Street", pincode: "Pincode" };
export default function StoreChangesScreen() {
  const { consumerId } = useLocalSearchParams<{ consumerId: string }>(), stores = useMyStores();
  useRefetchOnFocus(["stores"], ["store-changes", consumerId]);
  const store = stores.data?.find(s => s.consumerId === consumerId);
  return <SafeAreaView className="flex-1 bg-cream" edges={["top"]}><AppHeader title="Request store changes" showBack />{stores.isPending ? <LoadingState message="Loading store…" /> : !store || stores.isError ? <ErrorState message="Store unavailable or no longer managed by you." onRetry={stores.refetch} /> : <ChangesForm key={`${consumerId}:${store.detailsVersion || 0}`} store={store} />}</SafeAreaView>;
}
function ChangesForm({ store }: { store: Store }) {
  const client = useQueryClient();
  const initial = correctionValues(store);
  const [form, setForm] = useState(initial), [image, setImage] = useState<string | null>(null), [busy, setBusy] = useState(false), [problem, setProblem] = useState("");
  const [gps, setGps] = useState<CorrectionGps | null>(null), [page, setPage] = useState(1);
  const photoAt = useRef(0), requestId = useRef(newRequestId()), sending = useRef(false);
  const submittedPayload = useRef("");
  const location = useLocationCapture();
  const latest = useQuery({ queryKey: ["store-changes", store.consumerId, 1], queryFn: () => storeChangesApi.history(store.consumerId, 1) });
  const older = useQuery({ queryKey: ["store-changes", store.consumerId, page], queryFn: () => storeChangesApi.history(store.consumerId, page), enabled: page > 1 });
  const history = page === 1 ? latest : older;
  const pending = latest.data?.requests.some(request => request.status === "PENDING");
  const refreshHistory = () => client.invalidateQueries({ queryKey: ["store-changes", store.consumerId] });
  const captureGps = async () => {
    const photo = photoAt.current;
    if (!photo) { setProblem("Take a fresh photo before correcting the GPS location."); return; }
    setGps(null); setProblem(""); const result = await location.captureLocation();
    if (photo !== photoAt.current) return;
    if (result.ok) setGps({ latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy, capturedAt: result.capturedAt, photoTakenAt: photo });
    else setProblem(result.reason === "imprecise" ? `GPS accuracy is ${result.accuracy} m. Retry for 50 m or better.` : "Could not capture fresh precise GPS. Check permissions and precise location, then retry outdoors.");
  };
  const photoCaptured = (uri: string) => { if (sending.current) return; photoAt.current = Date.now(); setImage(uri); void captureGps(); };
  const submit = async () => {
    if (sending.current || pending || latest.isPending || latest.isError || location.capturing) return;
    const { changes, error } = buildStoreCorrection(store, form, gps, Boolean(image));
    if (error) { setProblem(error); return; }
    const payload = JSON.stringify({ changes, image });
    if (submittedPayload.current && submittedPayload.current !== payload) requestId.current = newRequestId();
    submittedPayload.current = payload;
    sending.current = true; setBusy(true); setProblem("");
    try { await storeChangesApi.submit(store.consumerId, changes, requestId.current, image); toast.success("Request submitted", "Your current store details stay in use until the office approves the request."); requestId.current = newRequestId(); submittedPayload.current = ""; photoAt.current = 0; setImage(null); setGps(null); setForm(initial); setPage(1); await refreshHistory(); }
    catch (e) { setProblem(getErrorMessage(e)); await refreshHistory(); }
    finally { sending.current = false; setBusy(false); }
  };
  return <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled"><View className="mb-5 rounded-2xl border border-cardamom-100 bg-cardamom-100 p-4"><Text className="font-display-bold text-lg text-ink">{store.storeName}</Text><Text className="mt-1 font-sans text-xs text-cardamom-700">{store.consumerId}</Text><Text className="mt-3 font-sans text-sm leading-5 text-cardamom-700">Correct the details below and send them for office approval. Your current store details stay in use until approval.</Text><Text className="mt-2 font-sans text-xs text-cardamom-700">Store type, agent assignment and historical invoices stay unchanged.</Text></View><Text className="mb-3 font-display-bold text-base text-ink">Store and contact details</Text>
    {Object.entries(initial).map(([key]) => <View key={key} className="mb-3">{key === "state" && <Text className="mb-3 mt-3 font-display-bold text-base text-ink">Store address</Text>}<Text className="mb-1 font-sans-semibold text-sm text-ink-700">{labels[key]}{key === "gstNumber" ? " (optional)" : ""}</Text><TextInput accessibilityLabel={labels[key]} value={form[key as keyof typeof form]} editable={!busy && !pending} onChangeText={value => setForm(current => ({ ...current, [key]: value }))} keyboardType={["phone", "pincode"].includes(key) ? "number-pad" : "default"} maxLength={key === "phone" ? 10 : key === "pincode" ? 6 : key === "gstNumber" ? 15 : ["state", "city", "street"].includes(key) ? 300 : 120} autoCapitalize={key === "gstNumber" || key === "state" ? "characters" : "sentences"} className="rounded-xl border border-sand bg-white px-3 py-3 font-sans text-ink" /></View>)}
    {!pending && <><ImagePickerField label="Replacement store photo (optional)" required={false} disabled={busy || location.capturing} uri={image} onChange={photoCaptured} mode="camera" /><Text className="mb-2 font-sans text-xs text-ink-500">A fresh replacement photo also captures corrected GPS. You can retry until accuracy is within 50 m.</Text>{image && <Button label={location.capturing ? "Capturing GPS…" : "Retry GPS capture"} loading={location.capturing} variant="outline" onPress={captureGps} />}{gps && <Text className="my-2 font-sans text-xs text-cardamom-700">Accuracy: {Math.ceil(gps.accuracy)} m</Text>}</>}
    {problem && <Text accessibilityRole="alert" className="my-3 rounded-xl bg-chili-100 p-3 font-sans text-sm text-chili-700">{problem}</Text>}{pending ? <Text className="my-4 rounded-xl bg-saffron-50 p-4 font-sans-semibold text-sm text-saffron-700">This store has a pending request. Wait for its review before submitting another.</Text> : <Button label="Submit for approval" onPress={submit} loading={busy} disabled={location.capturing || latest.isPending || latest.isError || Boolean(image && !gps)} fullWidth />}
    <Text className="mb-2 mt-6 font-display-bold text-lg text-ink">Request history</Text>{latest.isError && page > 1 && <Button label="Retry latest request status" variant="outline" onPress={() => latest.refetch()} />}{history.isPending ? <Text className="font-sans text-sm text-ink-500">Loading requests…</Text> : history.isError ? <Button label="Retry request history" variant="outline" onPress={() => history.refetch()} /> : history.data.requests.map(request => <View key={request._id} className="mb-3 rounded-xl border border-sand bg-white p-4"><Text className="font-sans-bold text-sm text-ink">{request.status} · {formatDateTime(request.createdAt)}</Text>{Object.entries(request.proposed).map(([key, value]) => <Text key={key} className="mt-1 font-sans text-xs text-ink-500">{labels[key] || (key === "address" ? "Address" : key === "location" ? "GPS location" : "Photo")}: {typeof value === "string" ? value || "Cleared" : key === "address" ? Object.values(value as object).join(", ") : key === "location" ? "Corrected captured location" : "Replacement photo"}</Text>)}{Boolean(request.proposed.image) && <Image source={{ uri: (request.proposed.image as { url: string }).url }} className="mt-2 h-24 w-24 rounded-lg" />}{request.reason && <Text className="mt-2 font-sans-semibold text-xs text-ink-700">Office: {request.reason}</Text>}</View>)}
    {history.data && history.data.pages > 1 && <View className="flex-row justify-between"><Button label="Previous" variant="outline" disabled={page <= 1} onPress={() => setPage(n => n - 1)} /><Text className="font-sans text-xs text-ink-500">{page} / {history.data.pages}</Text><Button label="Next" variant="outline" disabled={page >= history.data.pages} onPress={() => setPage(n => n + 1)} /></View>}
    <Button label="Refresh store details" variant="outline" className="mt-4" onPress={() => { client.invalidateQueries({ queryKey: ["stores"] }); refreshHistory(); }} />
  </ScrollView></KeyboardAvoidingView>;
}
