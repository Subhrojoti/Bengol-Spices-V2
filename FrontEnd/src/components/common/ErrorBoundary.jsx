import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router-dom";
import ErrorPage from "../../components/common/ErrorPage";

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return <ErrorPage message={error?.message} onRetry={resetErrorBoundary} />;
};

/* Must render inside the router. Changing route clears the error, so one
   page that fails to render does not keep every other page on the error
   screen until a full reload. */
const ErrorBoundary = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      resetKeys={[pathname]}
      onError={(error, info) => {
        console.error("Error caught:", error, info);
      }}>
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
