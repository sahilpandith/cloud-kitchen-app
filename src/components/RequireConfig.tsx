import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useDataStore } from "../store/useDataStore";

export default function RequireConfig({ children }: { children: ReactNode }) {
  const config = useDataStore((s) => s.config);
  if (!config) return <Navigate to="/settings" replace />;
  return <>{children}</>;
}
