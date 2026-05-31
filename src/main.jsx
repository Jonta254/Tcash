import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/layout/AppErrorBoundary";
import SafeMiniKitProvider from "./components/world/SafeMiniKitProvider";
import "./styles.css";
import {
  backfillExistingOrdersToAdminQueue,
  initializeOrders,
  initializeSettings,
  initializeUsers,
} from "./services";
import { initializeTheme } from "./services/themeService";

try {
  initializeUsers();
  initializeOrders();
  initializeSettings();
  initializeTheme();
  void backfillExistingOrdersToAdminQueue().catch(() => null);
} catch (error) {
  console.warn("TMpesa boot setup skipped", error);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <SafeMiniKitProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SafeMiniKitProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
