import { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { tokenStorage } from "@/utils/tokenStorage";
// The same address api/client.ts calls. expo-file-system's downloadFileAsync
// needs the full URL, so it is used here directly rather than through axios.
// It used to be worked out a second time in this file, and the two could
// disagree in an installed build.
import { API_URL } from "@/api/baseUrl";
import { toast } from "@/utils/toast";

/* What to tell the agent when the invoice could not be fetched. The phone's
   downloader reports only its own words ("Call to function
   'FileSystem.downloadFileAsync' has been rejected … response has status:
   503"), never the server's, and that text used to be shown as it was. */
function invoiceProblem(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const status = Number(text.match(/(?:status:?|HTTP)\s*(\d{3})/i)?.[1]);

  if (status === 503) return "The invoice is still being prepared. Please try again in a minute.";
  if (status === 404) return "No invoice was found for this order.";
  if (status === 401 || status === 403) return "Your session has ended. Please sign in again.";
  if (status >= 500) return "The invoice could not be downloaded just now. Please try again in a minute.";
  if (!status) return "Can't reach the server. Check your internet connection and try again.";
  return "The invoice could not be downloaded. Please try again.";
}

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
      const url = `${API_URL}/api/invoice/download/${encodeURIComponent(orderId)}`;
      // Only what an order number is made of goes into the file's name
      const destination = new File(Paths.cache, `invoice-${orderId.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`);
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
      toast.error("Couldn't download invoice", invoiceProblem(e));
    } finally {
      setDownloading(false);
    }
  };

  return { downloadInvoice, downloading };
}
