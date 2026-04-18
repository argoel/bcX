import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useStore } from "../state/store";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useStore();
  if (!state.employer) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
