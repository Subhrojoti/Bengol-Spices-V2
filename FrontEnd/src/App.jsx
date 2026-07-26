import { BrowserRouter } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { ToastContainer } from "react-toastify";
import ErrorBoundary from "./components/common/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRouter />
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
