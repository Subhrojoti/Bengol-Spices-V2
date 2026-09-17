import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import AppRouter from "./routes/AppRouter";
import ErrorBoundary from "./components/common/ErrorBoundary";

/* Replaces react-toastify's stock glyphs with the same icon set the rest of
   the panels use, so a toast looks like it belongs to the app. */
const ToastIcon = ({ type }) => {
  const common = { size: 18, strokeWidth: 2.2 };

  switch (type) {
    case "success":
      return <CheckCircle2 {...common} color="#0ca30c" />;
    case "error":
      return <XCircle {...common} color="#d03b3b" />;
    case "warning":
      return <TriangleAlert {...common} color="#b47c00" />;
    default:
      return <Info {...common} color="#2a78d6" />;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRouter />
        <ToastContainer
          position="top-right"
          autoClose={3500}
          newestOnTop
          closeOnClick
          pauseOnHover
          pauseOnFocusLoss={false}
          draggable
          hideProgressBar={false}
          theme="light"
          icon={ToastIcon}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
