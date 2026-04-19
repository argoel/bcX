import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { getActiveTenant, useStore } from "../state/store";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const tenant = getActiveTenant(state);
  if (!tenant) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
