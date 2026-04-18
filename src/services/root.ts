/* ────────────────────────────────────────────────────────────────────────
   services/root.ts

   myPay talks to Root through a single `RootClient` interface.  There
   are two implementations:

     • mockClient — purely client-side, simulates the sandbox with
       deterministic IDs and timed settlement.  Used when
       `VITE_USE_MOCK_ROOT !== "false"` (the default).

     • apiClient — calls `/api/root/*`, which Vite's dev proxy forwards
       to Root's sandbox with the server-side Authorization header
       injected.  Used when `VITE_USE_MOCK_ROOT === "false"`.

   Every call returns `{ resource, activity }`.  The caller is then
   responsible for commiting both to the store via `update(draft)`, so
   Root state flows through the same single-writer path as the rest of
   the app.  Settlement (webhook-driven on Root) is simulated by the
   store on an interval while running under the mock.

   ⚠ The real endpoint paths / payload shapes below are educated
   guesses based on Root's public description.  Once you have Root's
   actual reference docs, adjust the fetch URLs and the request/response
   mapping in `apiClient`.
   ──────────────────────────────────────────────────────────────────────── */

import type {
  Employer,
  RootActivityEntry,
  RootBankToken,
  RootSubaccount,
  RootTransfer,
} from "../types";

/* ---- State container (stored client-side as a cache) ----------------- */

export interface RootState {
  subaccounts: Record<string, RootSubaccount>;
  bankTokens: Record<string, RootBankToken>;
  transfers: RootTransfer[];
  activity: RootActivityEntry[];
}

export const emptyRootState = (): RootState => ({
  subaccounts: {},
  bankTokens: {},
  transfers: [],
  activity: [],
});

/* ---- UI metadata ----------------------------------------------------- */

export const ROOT_SANDBOX_BASE_URL =
  import.meta.env.VITE_ROOT_SANDBOX_DISPLAY_URL ??
  "https://sandbox.api.useroot.com/v1";

/** Shown in the UI only; the real key lives server-side. */
export const ROOT_SANDBOX_API_KEY_DISPLAY = "root_sk_sandbox_••••_server_only";

export const USE_MOCK =
  (import.meta.env.VITE_USE_MOCK_ROOT ?? "true") !== "false";

/* ---- Shared helpers -------------------------------------------------- */

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function activity(
  partial: Omit<RootActivityEntry, "id" | "at">,
): RootActivityEntry {
  return {
    ...partial,
    id: newId("act"),
    at: new Date().toISOString(),
  };
}

/* ---- Call shapes ----------------------------------------------------- */

export interface CreateSubaccountInput {
  employer: Pick<Employer, "id" | "companyName">;
}
export interface LinkBankInput {
  ownerType: "employer" | "employee";
  ownerId: string;
  bankName: string;
  accountType: "checking" | "savings";
  last4: string;
  achDebitAuthorized: boolean;
}
export interface DebitInput {
  subaccountId: string;
  employerBankTokenId: string;
  amountCents: number;
  memo: string;
}
export interface DisburseInput {
  subaccountId: string;
  employeeBankTokenId: string;
  amountCents: number;
  employeeId: string;
  payrollRunId: string;
  memo: string;
  rail?: "ach" | "rtp";
}

/** Every call returns the created/changed resource plus an activity entry
 *  so the caller can commit both to the store atomically. */
export interface ClientResult<T> {
  resource: T;
  /** Additional resources whose balance changed as a side effect (e.g.
   *  the subaccount after a debit / disbursement). */
  subaccount?: RootSubaccount;
  activity: RootActivityEntry;
}

export interface RootClient {
  createSubaccount(input: CreateSubaccountInput): Promise<ClientResult<RootSubaccount>>;
  linkBankAccount(input: LinkBankInput): Promise<ClientResult<RootBankToken>>;
  initiateAchDebit(
    input: DebitInput,
    snapshot: { subaccount: RootSubaccount; bank: RootBankToken },
  ): Promise<ClientResult<RootTransfer>>;
  initiateDisbursement(
    input: DisburseInput,
    snapshot: { subaccount: RootSubaccount; bank: RootBankToken },
  ): Promise<ClientResult<RootTransfer>>;
}

/* ================================================================== */
/*  Mock client                                                         */
/* ================================================================== */

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const mockClient: RootClient = {
  async createSubaccount({ employer }) {
    await delay(400);
    const sub: RootSubaccount = {
      id: newId("sub"),
      employerId: employer.id,
      balanceCents: 0,
      pendingInCents: 0,
      pendingOutCents: 0,
    };
    return {
      resource: sub,
      activity: activity({
        endpoint: "POST /v1/subaccounts",
        summary: `Created subaccount for ${employer.companyName}`,
        request: { employer_id: employer.id, name: employer.companyName },
        response: { id: sub.id, status: "active", balance: "0.00 USD" },
        status: "ok",
      }),
    };
  },

  async linkBankAccount(input) {
    await delay(500);
    const token: RootBankToken = {
      id: newId("btok"),
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      bankName: input.bankName,
      accountType: input.accountType,
      last4: input.last4,
      achDebitAuthorized: input.achDebitAuthorized,
      createdAt: new Date().toISOString(),
    };
    return {
      resource: token,
      activity: activity({
        endpoint: "POST /v1/bank-accounts (via SDK Link)",
        summary:
          input.ownerType === "employer"
            ? `Linked employer operating account (${input.bankName} ••${input.last4})${
                input.achDebitAuthorized ? " with ACH debit auth" : ""
              }`
            : `Linked employee payout account (${input.bankName} ••${input.last4})`,
        request: {
          owner: { type: input.ownerType, id: input.ownerId },
          processor: "root-link",
          ach_debit_authorization: input.achDebitAuthorized,
        },
        response: { id: token.id, last4: input.last4, status: "verified" },
        status: "ok",
      }),
    };
  },

  async initiateAchDebit(input, snap) {
    await delay(400);
    if (!snap.bank.achDebitAuthorized)
      throw new Error("bank is not authorized for ACH debit");
    const transfer: RootTransfer = {
      id: newId("tr"),
      subaccountId: snap.subaccount.id,
      type: "debit-in",
      bankTokenId: snap.bank.id,
      amountCents: input.amountCents,
      rail: "ach",
      status: "pending",
      memo: input.memo,
      createdAt: new Date().toISOString(),
    };
    const sub: RootSubaccount = {
      ...snap.subaccount,
      pendingInCents: snap.subaccount.pendingInCents + input.amountCents,
    };
    return {
      resource: transfer,
      subaccount: sub,
      activity: activity({
        endpoint: "POST /v1/transfers (ACH debit pull)",
        summary: `ACH debit pull $${(input.amountCents / 100).toFixed(2)} from ${snap.bank.bankName} ••${snap.bank.last4} → subaccount`,
        request: {
          subaccount_id: snap.subaccount.id,
          source_bank_token: snap.bank.id,
          amount: input.amountCents,
          direction: "debit",
          rail: "ach",
        },
        response: { id: transfer.id, status: "pending" },
        status: "ok",
      }),
    };
  },

  async initiateDisbursement(input, snap) {
    await delay(300);
    if (snap.subaccount.balanceCents < input.amountCents)
      throw new Error("insufficient balance");
    const rail = input.rail ?? "ach";
    const transfer: RootTransfer = {
      id: newId("tr"),
      subaccountId: snap.subaccount.id,
      type: "credit-out",
      bankTokenId: snap.bank.id,
      amountCents: input.amountCents,
      rail,
      status: "pending",
      employeeId: input.employeeId,
      payrollRunId: input.payrollRunId,
      memo: input.memo,
      createdAt: new Date().toISOString(),
    };
    const sub: RootSubaccount = {
      ...snap.subaccount,
      balanceCents: snap.subaccount.balanceCents - input.amountCents,
      pendingOutCents: snap.subaccount.pendingOutCents + input.amountCents,
    };
    return {
      resource: transfer,
      subaccount: sub,
      activity: activity({
        endpoint: "POST /v1/transfers (disbursement)",
        summary: `${rail.toUpperCase()} disbursement $${(input.amountCents / 100).toFixed(2)} → ${snap.bank.bankName} ••${snap.bank.last4}`,
        request: {
          subaccount_id: snap.subaccount.id,
          destination_bank_token: snap.bank.id,
          amount: input.amountCents,
          direction: "credit",
          rail,
          memo: input.memo,
        },
        response: { id: transfer.id, status: "pending" },
        status: "ok",
      }),
    };
  },
};

/* ================================================================== */
/*  API client — real sandbox calls through the /api/root proxy         */
/* ================================================================== */

const API_BASE = "/api/root";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Root ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

/* The shapes below assume a fairly standard REST body.  Adjust to Root's
 * actual schema once the docs are accessible. */

interface ApiSubaccount {
  id: string;
  employer_id: string;
  balance_cents: number;
  pending_in_cents?: number;
  pending_out_cents?: number;
}
interface ApiBankToken {
  id: string;
  owner: { type: "employer" | "employee"; id: string };
  bank_name: string;
  account_type: "checking" | "savings";
  last4: string;
  ach_debit_authorized: boolean;
  created_at: string;
}
interface ApiTransfer {
  id: string;
  subaccount_id: string;
  direction: "debit" | "credit";
  rail: "ach" | "rtp";
  bank_token_id: string;
  amount_cents: number;
  status: "pending" | "settled" | "failed";
  memo?: string;
  created_at: string;
  settled_at?: string;
}

const apiClient: RootClient = {
  async createSubaccount({ employer }) {
    const body = { employer_id: employer.id, name: employer.companyName };
    const out = await post<ApiSubaccount>("/subaccounts", body);
    const sub: RootSubaccount = {
      id: out.id,
      employerId: out.employer_id,
      balanceCents: out.balance_cents,
      pendingInCents: out.pending_in_cents ?? 0,
      pendingOutCents: out.pending_out_cents ?? 0,
    };
    return {
      resource: sub,
      activity: activity({
        endpoint: "POST /v1/subaccounts",
        summary: `Created subaccount for ${employer.companyName}`,
        request: body,
        response: out,
        status: "ok",
      }),
    };
  },

  async linkBankAccount(input) {
    // In a real integration, the browser would use the Root JS SDK to
    // exchange a public link-token for a persistent bank token.  Our
    // proxy mirrors that by accepting the SDK's linkSessionId and
    // forwarding to Root; here we send the tokenized bank directly for
    // demo purposes.
    const body = {
      owner: { type: input.ownerType, id: input.ownerId },
      bank_name: input.bankName,
      account_type: input.accountType,
      last4: input.last4,
      ach_debit_authorized: input.achDebitAuthorized,
    };
    const out = await post<ApiBankToken>("/bank-accounts", body);
    const token: RootBankToken = {
      id: out.id,
      ownerType: out.owner.type,
      ownerId: out.owner.id,
      bankName: out.bank_name,
      accountType: out.account_type,
      last4: out.last4,
      achDebitAuthorized: out.ach_debit_authorized,
      createdAt: out.created_at,
    };
    return {
      resource: token,
      activity: activity({
        endpoint: "POST /v1/bank-accounts",
        summary:
          input.ownerType === "employer"
            ? `Linked employer operating account (${input.bankName} ••${input.last4})`
            : `Linked employee payout account (${input.bankName} ••${input.last4})`,
        request: body,
        response: out,
        status: "ok",
      }),
    };
  },

  async initiateAchDebit(input, snap) {
    const body = {
      subaccount_id: input.subaccountId,
      source_bank_token: input.employerBankTokenId,
      amount_cents: input.amountCents,
      direction: "debit" as const,
      rail: "ach" as const,
      memo: input.memo,
    };
    const out = await post<ApiTransfer>("/transfers", body);
    const transfer: RootTransfer = {
      id: out.id,
      subaccountId: out.subaccount_id,
      type: "debit-in",
      bankTokenId: out.bank_token_id,
      amountCents: out.amount_cents,
      rail: out.rail,
      status: out.status,
      memo: out.memo ?? input.memo,
      createdAt: out.created_at,
      settledAt: out.settled_at,
    };
    const sub: RootSubaccount = {
      ...snap.subaccount,
      pendingInCents: snap.subaccount.pendingInCents + input.amountCents,
    };
    return {
      resource: transfer,
      subaccount: sub,
      activity: activity({
        endpoint: "POST /v1/transfers",
        summary: `ACH debit pull $${(input.amountCents / 100).toFixed(2)} from ${snap.bank.bankName} ••${snap.bank.last4}`,
        request: body,
        response: out,
        status: "ok",
      }),
    };
  },

  async initiateDisbursement(input, snap) {
    const rail = input.rail ?? "ach";
    const body = {
      subaccount_id: input.subaccountId,
      destination_bank_token: input.employeeBankTokenId,
      amount_cents: input.amountCents,
      direction: "credit" as const,
      rail,
      memo: input.memo,
    };
    const out = await post<ApiTransfer>("/transfers", body);
    const transfer: RootTransfer = {
      id: out.id,
      subaccountId: out.subaccount_id,
      type: "credit-out",
      bankTokenId: out.bank_token_id,
      amountCents: out.amount_cents,
      rail: out.rail,
      status: out.status,
      employeeId: input.employeeId,
      payrollRunId: input.payrollRunId,
      memo: out.memo ?? input.memo,
      createdAt: out.created_at,
      settledAt: out.settled_at,
    };
    const sub: RootSubaccount = {
      ...snap.subaccount,
      balanceCents: snap.subaccount.balanceCents - input.amountCents,
      pendingOutCents: snap.subaccount.pendingOutCents + input.amountCents,
    };
    return {
      resource: transfer,
      subaccount: sub,
      activity: activity({
        endpoint: "POST /v1/transfers",
        summary: `${rail.toUpperCase()} disbursement $${(input.amountCents / 100).toFixed(2)} → ${snap.bank.bankName} ••${snap.bank.last4}`,
        request: body,
        response: out,
        status: "ok",
      }),
    };
  },
};

/* ---- Export chosen client -------------------------------------------- */

export const rootClient: RootClient = USE_MOCK ? mockClient : apiClient;

/* ---- Helpers to commit ClientResult-shaped responses to a RootState -- */

export function applySubaccount(
  state: RootState,
  result: ClientResult<RootSubaccount>,
) {
  state.subaccounts[result.resource.id] = result.resource;
  pushActivity(state, result.activity);
}

export function applyBankToken(
  state: RootState,
  result: ClientResult<RootBankToken>,
) {
  state.bankTokens[result.resource.id] = result.resource;
  pushActivity(state, result.activity);
}

export function applyTransfer(
  state: RootState,
  result: ClientResult<RootTransfer>,
) {
  state.transfers.unshift(result.resource);
  if (result.subaccount)
    state.subaccounts[result.subaccount.id] = result.subaccount;
  pushActivity(state, result.activity);
}

export function pushActivity(state: RootState, entry: RootActivityEntry) {
  state.activity.unshift(entry);
  if (state.activity.length > 200) state.activity.length = 200;
}

/* ---- Settlement simulation (mock only) ------------------------------- */

/**
 * In the mock, we advance pending transfers to "settled" on a timer.
 * In real mode this is a no-op — Root pushes webhooks and the backend
 * should update the local cache; that wiring is left for iteration 3.
 */
export function settleDueTransfers(
  state: RootState,
  now: Date = new Date(),
): RootTransfer[] {
  if (!USE_MOCK) return [];
  const settled: RootTransfer[] = [];
  for (const t of state.transfers) {
    if (t.status !== "pending") continue;
    const ageMs = now.getTime() - new Date(t.createdAt).getTime();
    const settleAfter =
      t.type === "debit-in" ? 6000 : t.rail === "rtp" ? 2000 : 4000;
    if (ageMs < settleAfter) continue;

    t.status = "settled";
    t.settledAt = now.toISOString();
    const sub = state.subaccounts[t.subaccountId];
    if (sub) {
      if (t.type === "debit-in") {
        sub.pendingInCents -= t.amountCents;
        sub.balanceCents += t.amountCents;
      } else {
        sub.pendingOutCents -= t.amountCents;
      }
    }
    state.activity.unshift(
      activity({
        endpoint: "webhook transfer.settled",
        summary: `Transfer ${t.id} settled (${t.type}, ${t.rail.toUpperCase()}, $${(t.amountCents / 100).toFixed(2)})`,
        response: { id: t.id, status: "settled" },
        status: "ok",
      }),
    );
    if (state.activity.length > 200) state.activity.length = 200;
    settled.push(t);
  }
  return settled;
}
