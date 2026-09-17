import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import { useDataStore } from "./store/useDataStore";
import "./index.css";

function AppStartup() {
  useEffect(() => {
    if (useDataStore.getState().config) {
      useDataStore.getState().loadData();
    }
  }, []);

  return <AppRoutes />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStartup />
    </BrowserRouter>
  </React.StrictMode>
);
