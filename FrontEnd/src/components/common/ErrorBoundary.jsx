import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import ErrorPage from "../../components/common/ErrorPage";

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return <ErrorPage message={error?.message} onRetry={resetErrorBoundary} />;
};

const ErrorBoundary = ({ children }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        console.error("Error caught:", error, info);
      }}>
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
