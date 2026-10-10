import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000";

// A connection that lasted this long counts as healthy
const STABLE_MS = 10 * 1000;

/* ─── Chime ──────────────────────────────────────────────────────────
   Two soft tones made with the Web Audio API, so no sound file ships
   with the app.

   Browsers only let a page make sound once the person has clicked or
   typed in it. The audio engine is therefore created the moment that is
   true and reused; until then an order still shows its toast, silently. */
let audioCtx = null;

const hasInteracted = () => navigator.userActivation?.hasBeenActive ?? false;

const ensureAudio = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
};

const playChime = async () => {
  if (!audioCtx && hasInteracted()) ensureAudio();
  const ctx = audioCtx;
  if (!ctx) return;

  /* A paused engine (the browser idled it) gets a moment to wake. Past
     that the chime is dropped: one that plays late, on some later click,
     would announce an order the admin has already read. */
  if (ctx.state !== "running") {
    await Promise.race([
      ctx.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    if (ctx.state !== "running") return;
  }

  const now = ctx.currentTime;
  [
    [880, 0],
    [1174.66, 0.14],
  ].forEach(([frequency, offset]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.75);
  });
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ─── Stream ──────────────────────────────────────────────────────────
   Listens to the server's live event stream for the signed-in panel and
   turns a new order into a toast, a chime and a window event the orders
   page refreshes on. Reconnects by itself if the connection drops.

   Plain fetch is used instead of EventSource so the token can travel in
   the Authorization header rather than in the URL. */
export default function useLiveOrders({ tokenKey, ordersPath }) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return undefined;

    /* One listening session at a time: its own stop switch and retry timer.
       A session ends when the page is left (see the bottom of this effect)
       and a new one starts if the page is brought back. */
    let controller = null;
    let retryTimer = null;
    let attempts = 0;
    // Orders already announced in this session, so a reconnect that happens
    // to replay one does not chime twice
    const seen = new Set();

    // Sound is ready at once if the person has already clicked (they just
    // signed in, say); otherwise the first click or key press unlocks it
    if (hasInteracted()) ensureAudio();
    const unlock = () => ensureAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const announce = (order) => {
      if (seen.has(order.orderId)) return;
      seen.add(order.orderId);
      if (seen.size > 200) seen.delete(seen.values().next().value);

      playChime();

      toast("New order placed", {
        id: `order-${order.orderId}`,
        description: `${order.orderId} · ${order.storeName}${
          order.city ? `, ${order.city}` : ""
        } · ${inr(order.totalAmount)}${
          order.dueAmount > 0 ? ` (${inr(order.dueAmount)} due)` : ""
        }`,
        icon: <ShoppingBag size={18} />,
        duration: 10000,
        // Straight to this order, opened, rather than the top of the list
        action: {
          label: "View order",
          onClick: () =>
            navigateRef.current(
              `${ordersPath}?order=${encodeURIComponent(order.orderId)}`,
            ),
        },
      });

      window.dispatchEvent(
        new CustomEvent("live:order-placed", { detail: order }),
      );
    };

    const handleMessage = (raw) => {
      let type = "message";
      const data = [];

      raw.split("\n").forEach((line) => {
        if (line.startsWith("event:")) type = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      });
      if (!data.length) return; // heartbeat comment

      try {
        const payload = JSON.parse(data.join("\n"));
        if (type === "ORDER_PLACED" && payload.order) announce(payload.order);

        /* Cash recorded by an agent, or approved or rejected by someone at
           the office. No toast or chime: the screens that show it (cash
           verification, the dashboard) just refresh themselves. */
        if (type === "CASH_VERIFICATION") {
          window.dispatchEvent(
            new CustomEvent("live:cash-verification", { detail: payload.payment }),
          );
        }
      } catch {
        /* a malformed event is dropped, the stream carries on */
      }
    };

    const connect = async () => {
      const startedAt = Date.now();
      // This attempt's own switch: a later session must not be stopped by,
      // or mistaken for, an earlier one that is still winding down
      const { signal } = controller;

      try {
        const res = await fetch(`${API_ROOT}/api/events/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal,
        });

        // Signed out or not allowed: nothing to listen for
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let end;
          while ((end = buffer.indexOf("\n\n")) !== -1) {
            handleMessage(buffer.slice(0, end));
            buffer = buffer.slice(end + 2);
          }
        }
      } catch {
        /* dropped connection — fall through to reconnect */
      }

      if (signal.aborted) return;

      /* Back off 1s, 2s, 4s … up to 30s. The count resets only after a
         connection that actually held: resetting on every connect meant a
         stream that opened and dropped at once was retried every second,
         forever. */
      if (Date.now() - startedAt > STABLE_MS) attempts = 0;
      const delay = Math.min(30000, 1000 * 2 ** attempts++);
      retryTimer = setTimeout(connect, delay);
    };

    const start = () => {
      if (controller) return; // already listening
      controller = new AbortController();
      attempts = 0;
      connect();
    };

    const stop = () => {
      controller?.abort();
      controller = null;
      clearTimeout(retryTimer);
    };

    /* Let go of the connection when the page is left.

       A browser keeps a page it has just navigated away from in memory, so
       Back is instant, and that page's open stream stayed open with it.
       Browsers allow six connections to one site over HTTP/1.1. Six page
       loads in the panel (a typed address, a bookmark, a link opened in the
       same tab) therefore left six idle streams holding every connection,
       and the next page could not reach the API at all: it sat on its
       loading spinner until one of the old streams timed out.

       "pagehide" fires as the page is put away; "pageshow" with
       persisted=true fires if it is brought back from memory, and the
       stream is opened again. Switching tabs fires neither, so a panel left
       open in a background tab still chimes. */
    const onPageHide = () => stop();
    const onPageShow = (event) => {
      if (event.persisted) start();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    start();

    return () => {
      stop();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [tokenKey, ordersPath]);
}
