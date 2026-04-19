/* ────────────────────────────────────────────────────────────────────────
   state/store.ts

   Multi-tenant app store.  Every employer (identified by their Google
   Workspace domain) gets a `Tenant` slice under `tenants[domain]`.
   Multiple admins from the same domain share the same tenant — signing
   in is idempotent per-domain.

   • `state.session.domain` points at the currently-active tenant.
   • Logout = clearing `session.domain`.  Tenant data stays, so anyone
     from the same domain (in this browser) can sign back in and land
     in the same console.
   • Root resources (subaccounts, bank tokens, payees, transfers, the
     activity log) are shared across tenants — each is keyed/filtered by
     subaccountId where relevant.
   ──────────────────────────────────────────────────────────────────────── */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, Tenant } from "../types";
import {
  emptyRootState,
  settleDueTransfers,
  type RootState,
} from "../services/root";

const STORAGE_KEY = "mypay.state.v2";

export interface AppState {
  session: Session;
  tenants: Record<string, Tenant>;
  root: RootState;
}

const emptyState = (): AppState => ({
  session: { domain: null, adminEmail: null },
  tenants: {},
  root: emptyRootState(),
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      session: parsed.session ?? { domain: null, adminEmail: null },
      tenants: parsed.tenants ?? {},
      root: {
        subaccounts: parsed.root?.subaccounts ?? {},
        bankTokens: parsed.root?.bankTokens ?? {},
        payees: parsed.root?.payees ?? {},
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

/* ---- Helpers --------------------------------------------------------- */

/** Returns the active tenant (or null if no session / unknown domain). */
export function getActiveTenant(state: AppState): Tenant | null {
  if (!state.session.domain) return null;
  return state.tenants[state.session.domain] ?? null;
}

/** Mutate the active tenant inside an `update(draft)` callback. */
export function withActiveTenant(
  draft: AppState,
  fn: (tenant: Tenant) => void,
): void {
  const domain = draft.session.domain;
  if (!domain) return;
  const tenant = draft.tenants[domain];
  if (!tenant) return;
  fn(tenant);
}

/* ---- Context --------------------------------------------------------- */

export interface Store {
  state: AppState;
  /** Pass a function that mutates `draft`; we snapshot, persist, and
   *  re-render.  Uses a functional setState internally so concurrent
   *  background ticks (settlement) can't overwrite your changes. */
  update(fn: (draft: AppState) => void): void;
  /** Clear the entire app state including all tenants.  Mostly for
   *  the demo reset button — normal sign-out should only clear the
   *  session. */
  hardReset(): void;
}

const StoreCtx = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Convenience hook — returns the active tenant (or null). */
export function useActiveTenant(): Tenant | null {
  const { state } = useStore();
  return getActiveTenant(state);
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

  const hardReset = useCallback(() => {
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

        // Reconcile payroll run line items across all tenants.
        for (const t of settled) {
          if (!t.payrollRunId || !t.employeeId) continue;
          for (const tenant of Object.values(draft.tenants)) {
            const run = tenant.payrollRuns.find(
              (r) => r.id === t.payrollRunId,
            );
            if (!run) continue;
            const li = run.lineItems.find(
              (l) => l.employeeId === t.employeeId,
            );
            if (li && li.status === "disbursing") li.status = "paid";
          }
        }

        // Mark runs complete / partial when every line item is terminal.
        for (const tenant of Object.values(draft.tenants)) {
          for (const run of tenant.payrollRuns) {
            if (run.status !== "running") continue;
            const allSettled = run.lineItems.every(
              (l) =>
                l.status === "paid" ||
                l.status === "skipped" ||
                l.status === "failed",
            );
            if (allSettled) {
              const anyFailed = run.lineItems.some(
                (l) => l.status === "failed",
              );
              run.status = anyFailed ? "partial" : "complete";
              run.completedAt = new Date().toISOString();
            }
          }
        }

        save(draft);
        return draft;
      });
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(
    () => ({ state, update, hardReset }),
    [state, update, hardReset],
  );
}

export { StoreCtx };
