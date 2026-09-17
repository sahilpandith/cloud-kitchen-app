import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireConfig from "./components/RequireConfig";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Expenses from "./pages/Expenses";
import ProfitLoss from "./pages/ProfitLoss";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/settings"
        element={
          <Layout>
            <Settings />
          </Layout>
        }
      />
      <Route
        path="/"
        element={
          <RequireConfig>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/sales"
        element={
          <RequireConfig>
            <Layout>
              <Sales />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireConfig>
            <Layout>
              <Inventory />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/expenses"
        element={
          <RequireConfig>
            <Layout>
              <Expenses />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/profit-loss"
        element={
          <RequireConfig>
            <Layout>
              <ProfitLoss />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/insights"
        element={
          <RequireConfig>
            <Layout>
              <Insights />
            </Layout>
          </RequireConfig>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
