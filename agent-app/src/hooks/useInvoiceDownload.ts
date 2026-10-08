import { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { tokenStorage } from "@/utils/tokenStorage";
import { getErrorMessage } from "@/api/client";
// The same address api/client.ts calls. expo-file-system's downloadFileAsync
// needs the full URL, so it is used here directly rather than through axios.
// It used to be worked out a second time in this file, and the two could
// disagree in an installed build.
import { API_URL } from "@/api/baseUrl";
import { toast } from "@/utils/toast";

export function useInvoiceDownload() {
  const [downloading, setDownloading] = useState(false);

  // 🔥 FIX: no longer takes a baseUrl parameter — every call site was
  // passing "" (an empty placeholder that never got filled in), which
  // built a relative URL and crashed FileSystem.downloadFileAsync with
  // "URI is not absolute". Resolving it internally means there's no longer
  // a value for a caller to forget to pass.
  const downloadInvoice = async (orderId: string) => {
    setDownloading(true);
    try {
      const token = await tokenStorage.get();
      const url = `${API_URL}/api/invoice/download/${orderId}`;
      const destination = new File(Paths.cache, `invoice-${orderId}.pdf`);
      const downloaded = await File.downloadFileAsync(url, destination, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, { mimeType: "application/pdf" });
      }
    } catch (e) {
      // 🔥 FIX: there was no catch here before — any failure (network
      // issue, missing invoice, this exact bug, etc.) became an unhandled
      // promise rejection instead of a clean, user-facing message.
      toast.error("Couldn't download invoice", getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  return { downloadInvoice, downloading };
}
