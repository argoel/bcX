import type { ReactNode } from "react";
import { StoreCtx, useStoreValue } from "../state/store";

export default function AppProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue();
  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}
