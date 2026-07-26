import React from "react";
import ErrorLogo from "../../assets/logo/Error_Logo.png";

const ErrorPage = ({ message = "Something went wrong", onRetry }) => {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center bg-white px-4 sm:px-6 md:px-16 py-6">
      {/* RIGHT SECTION (LOGO) */}
      <div className="flex-1 flex justify-center items-center order-1 md:order-2">
        <img
          src={ErrorLogo}
          alt="error illustration"
          className="w-[160px] sm:w-[200px] md:w-[320px] lg:w-[380px] object-contain opacity-90"
        />
      </div>

      {/* LEFT SECTION (TEXT) */}
      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left max-w-xl md:pl-60 mt-6 md:mt-0 order-2 md:order-1">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-orange-600 mb-2">
          Ooops.
        </h1>

        <p className="text-gray-600 text-base sm:text-lg mb-10">
          Relax, take it easy.
        </p>

        <p className="text-sm sm:text-base flex flex-col mb-4">
          {/* <span className="text-red-500 font-medium">Error:</span>{" "} */}
          {/* <span className="text-gray-500 break-words">{message}</span> */}
          <span className="text-red-500 break-words">Something went wrong</span>
          <span className="text-gray-500 break-words">
            Please check again after sometime
          </span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 transition text-white px-5 py-2.5 rounded-lg shadow-md">
            Reload Page
          </button>

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
