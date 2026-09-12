import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./dashboard.css";
import { initializeLocale } from "./lib/locale-client";
await initializeLocale().catch(() => {});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  </React.StrictMode>,
);
