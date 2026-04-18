/* ────────────────────────────────────────────────────────────────────────
   state/store.ts

   Tiny global app store.  myPay has no backend — everything the payroll
   admin sees lives in localStorage keyed under "mypay.state.v1".  We
   snapshot on every mutation, and periodically advance Root transfers
   toward settlement so the UI feels alive.
   ──────────────────────────────────────────────────────────────────────── */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Employer,
  Employee,
  PayrollRun,
} from "../types";
import {
  emptyRootState,
  settleDueTransfers,
  type RootState,
} from "../services/root";

const STORAGE_KEY = "mypay.state.v1";

export interface AppState {
  employer: Employer | null;
  employees: Employee[];
  payrollRuns: PayrollRun[];
  root: RootState;
}

const emptyState = (): AppState => ({
  employer: null,
  employees: [],
  payrollRuns: [],
  root: emptyRootState(),
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    return {
      employer: parsed.employer ?? null,
      employees: parsed.employees ?? [],
      payrollRuns: parsed.payrollRuns ?? [],
      root: {
        subaccounts: parsed.root?.subaccounts ?? {},
        bankTokens: parsed.root?.bankTokens ?? {},
        transfers: parsed.root?.transfers ?? [],
        activity: parsed.root?.activity ?? [],
      },
    };
  } catch {
    return emptyState();
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function cloneState(s: AppState): AppState {
  return JSON.parse(JSON.stringify(s));
}

/* ---- Context --------------------------------------------------------- */

export interface Store {
  state: AppState;
  /** Pass a function that mutates `draft`; we snapshot, persist, and
   *  re-render.  Uses a functional setState internally so concurrent
   *  background ticks (settlement) can't overwrite your changes. */
  update(fn: (draft: AppState) => void): void;
  reset(): void;
}

const StoreCtx = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useAppState() {
  return useStore().state;
}

/* ---- Provider hook --------------------------------------------------- */

export function useStoreValue(): Store {
  const [state, setState] = useState<AppState>(() => load());

  const update = useCallback((fn: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = cloneState(prev);
      fn(draft);
      save(draft);
      return draft;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh = emptyState();
    save(fresh);
    setState(fresh);
  }, []);

  // Drive Root settlement on an interval.  Settling is idempotent and
  // safe to run concurrently with user mutations because we use
  // functional setState here too.
  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const draft = cloneState(prev);
        const settled = settleDueTransfers(draft.root);
        if (settled.length === 0) return prev;

        // Reconcile payroll run line items with settled disbursements.
        for (const t of settled) {
          if (!t.payrollRunId || !t.employeeId) continue;
          const run = draft.payrollRuns.find((r) => r.id === t.payrollRunId);
          if (!run) continue;
          const li = run.lineItems.find((l) => l.employeeId === t.employeeId);
          if (li && li.status === "disbursing") li.status = "paid";
        }

        // Mark runs complete / partial when every line item is terminal.
        for (const run of draft.payrollRuns) {
          if (run.status !== "running") continue;
          const allSettled = run.lineItems.every(
            (l) =>
              l.status === "paid" ||
              l.status === "skipped" ||
              l.status === "failed",
          );
          if (allSettled) {
            const anyFailed = run.lineItems.some((l) => l.status === "failed");
            run.status = anyFailed ? "partial" : "complete";
            run.completedAt = new Date().toISOString();
          }
        }

        save(draft);
        return draft;
      });
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => ({ state, update, reset }), [state, update, reset]);
}

export { StoreCtx };
