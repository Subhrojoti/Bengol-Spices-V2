import React, { useEffect } from "react";
import ErrorLogo from "../../assets/logo/Error_Logo.webp";

/* Two situations share this screen:

     - something crashed (the error boundary, or a failed request sent the
       browser to /error): "Something went wrong", with Reload;
     - the address does not exist (`notFound`, used by the router's
       catch-all): say so, and offer the way back.

   Telling someone who mistyped an address to reload sent them round in a
   circle. The home link is a plain <a>, so it works wherever this renders,
   including outside the router. */
const ErrorPage = ({ onRetry, notFound = false }) => {
  // The tab and the browser history should say what this is. No dependency
  // list: moving from one unknown address to another re-renders this same
  // screen, and the title has to be put back each time.
  useEffect(() => {
    if (notFound) document.title = "Page not found | Bengol Spices";
  });

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center bg-white px-4 sm:px-6 md:px-16 py-6">
      {/* RIGHT SECTION (LOGO) */}
      <div className="flex-1 flex justify-center items-center order-1 md:order-2">
        <img
          src={ErrorLogo}
          alt=""
          width={800}
          height={766}
          className="w-[160px] sm:w-[200px] md:w-[320px] lg:w-[380px] h-auto object-contain opacity-90"
        />
      </div>

      {/* LEFT SECTION (TEXT) */}
      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left max-w-xl md:pl-60 mt-6 md:mt-0 order-2 md:order-1">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-orange-600 mb-2">
          {notFound ? "Page not found" : "Ooops."}
        </h1>

        <p className="text-gray-600 text-base sm:text-lg mb-10">
          {notFound
            ? "That address does not lead anywhere."
            : "Relax, take it easy."}
        </p>

        <p className="text-sm sm:text-base flex flex-col mb-4">
          {notFound ? (
            <span className="text-gray-500 break-words">
              The link may be old, or the address may have been mistyped.
            </span>
          ) : (
            <>
              <span className="text-red-500 break-words">Something went wrong</span>
              <span className="text-gray-500 break-words">
                Please check again after sometime
              </span>
            </>
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {notFound ? (
            <a
              href="/"
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 transition text-white px-5 py-2.5 rounded-lg shadow-md text-center">
              Go to the home page
            </a>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 transition text-white px-5 py-2.5 rounded-lg shadow-md">
              Reload Page
            </button>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full sm:w-auto border border-orange-500 text-orange-600 hover:bg-orange-50 transition px-5 py-2.5 rounded-lg">
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
