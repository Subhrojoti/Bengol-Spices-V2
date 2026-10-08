const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loading = null;

/**
 * Loads Razorpay's checkout script the first time a payment needs it.
 *
 * It used to sit in index.html, so every visitor to the public website
 * downloaded a payment library they would never use. Resolves true once
 * window.Razorpay exists, false if the script could not be fetched (offline,
 * blocked by an extension) so the caller can say so instead of crashing.
 *
 * @returns {Promise<boolean>}
 */
export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;

  loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      // Let the next attempt try again rather than remembering the failure
      loading = null;
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loading;
};
