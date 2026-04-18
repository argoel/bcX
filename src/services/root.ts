/* ────────────────────────────────────────────────────────────────────────
   services/root.ts

   Thin wrapper that simulates the Root sandbox
   (docs.useroot.com + root-pay-js-sdk).  Every function mutates the
   provided `RootState` in-place and returns the created resource.  The
   UI adds artificial delays around these calls so the demo feels like
   real network traffic; the service itself is synchronous so it plays
   nicely with our single-flight `update()` store primitive.

   Swapping this for real sandbox calls means replacing the body of each
   function with a `fetch` to `https://sandbox.api.useroot.com/...` using
   the ROOT_SANDBOX_API_KEY.  The signatures stay the same.
   ──────────────────────────────────────────────────────────────────────── */

import type {
  Employer,
  RootBankToken,
  RootSubaccount,
  RootTransfer,
  RootActivityEntry,
} from "../types";

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

/** Sandbox API key shown in the UI (not a real secret). */
export const ROOT_SANDBOX_API_KEY = "root_sk_sandbox_mp_9f3c2a1b";
export const ROOT_SANDBOX_BASE_URL = "https://sandbox.api.useroot.com/v1";

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function logActivity(
  state: RootState,
  entry: Omit<RootActivityEntry, "id" | "at">,
): RootActivityEntry {
  const full: RootActivityEntry = {
    ...entry,
    id: newId("act"),
    at: new Date().toISOString(),
  };
  state.activity.unshift(full);
  if (state.activity.length > 200) state.activity.length = 200;
  return full;
}

/* ---- Subaccounts ----------------------------------------------------- */

export function createSubaccount(
  state: RootState,
  employer: Pick<Employer, "id" | "companyName">,
): RootSubaccount {
  const sub: RootSubaccount = {
    id: newId("sub"),
    employerId: employer.id,
    balanceCents: 0,
    pendingInCents: 0,
    pendingOutCents: 0,
  };
  state.subaccounts[sub.id] = sub;
  logActivity(state, {
    endpoint: "POST /v1/subaccounts",
    summary: `Created subaccount for ${employer.companyName}`,
    request: { employer_id: employer.id, name: employer.companyName },
    response: { id: sub.id, status: "active", balance: "0.00 USD" },
    status: "ok",
  });
  return sub;
}

/* ---- Bank tokens (via the Root JS SDK) ------------------------------- */

/** Simulates `rootPay.openBankLink(...)` resolving with a tokenized bank. */
export function linkBankAccount(
  state: RootState,
  input: {
    ownerType: "employer" | "employee";
    ownerId: string;
    bankName: string;
    accountType: "checking" | "savings";
    last4: string;
    achDebitAuthorized: boolean;
  },
): RootBankToken {
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
  state.bankTokens[token.id] = token;
  logActivity(state, {
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
  });
  return token;
}

/* ---- ACH debit pull (prefunding) ------------------------------------- */

export function initiateAchDebit(
  state: RootState,
  input: {
    subaccountId: string;
    employerBankTokenId: string;
    amountCents: number;
    memo: string;
  },
): RootTransfer {
  const sub = state.subaccounts[input.subaccountId];
  const bank = state.bankTokens[input.employerBankTokenId];
  if (!sub) throw new Error("subaccount not found");
  if (!bank) throw new Error("bank token not found");
  if (!bank.achDebitAuthorized)
    throw new Error("bank is not authorized for ACH debit");

  const transfer: RootTransfer = {
    id: newId("tr"),
    subaccountId: sub.id,
    type: "debit-in",
    bankTokenId: bank.id,
    amountCents: input.amountCents,
    rail: "ach",
    status: "pending",
    memo: input.memo,
    createdAt: new Date().toISOString(),
  };
  state.transfers.unshift(transfer);
  sub.pendingInCents += input.amountCents;
  logActivity(state, {
    endpoint: "POST /v1/transfers (ACH debit pull)",
    summary: `ACH debit pull $${(input.amountCents / 100).toFixed(2)} from ${bank.bankName} ••${bank.last4} → subaccount`,
    request: {
      subaccount_id: sub.id,
      source_bank_token: bank.id,
      amount: input.amountCents,
      direction: "debit",
      rail: "ach",
    },
    response: { id: transfer.id, status: "pending" },
    status: "ok",
  });
  return transfer;
}

/* ---- Disbursement (ACH / RTP credit push) ---------------------------- */

export function initiateDisbursement(
  state: RootState,
  input: {
    subaccountId: string;
    employeeBankTokenId: string;
    amountCents: number;
    employeeId: string;
    payrollRunId: string;
    memo: string;
    rail?: "ach" | "rtp";
  },
): RootTransfer {
  const sub = state.subaccounts[input.subaccountId];
  const bank = state.bankTokens[input.employeeBankTokenId];
  if (!sub) throw new Error("subaccount not found");
  if (!bank) throw new Error("bank token not found");
  if (sub.balanceCents < input.amountCents)
    throw new Error("insufficient balance");

  const rail = input.rail ?? "ach";
  const transfer: RootTransfer = {
    id: newId("tr"),
    subaccountId: sub.id,
    type: "credit-out",
    bankTokenId: bank.id,
    amountCents: input.amountCents,
    rail,
    status: "pending",
    employeeId: input.employeeId,
    payrollRunId: input.payrollRunId,
    memo: input.memo,
    createdAt: new Date().toISOString(),
  };
  state.transfers.unshift(transfer);
  sub.balanceCents -= input.amountCents;
  sub.pendingOutCents += input.amountCents;
  logActivity(state, {
    endpoint: "POST /v1/transfers (disbursement)",
    summary: `${rail.toUpperCase()} disbursement $${(input.amountCents / 100).toFixed(2)} → ${bank.bankName} ••${bank.last4}`,
    request: {
      subaccount_id: sub.id,
      destination_bank_token: bank.id,
      amount: input.amountCents,
      direction: "credit",
      rail,
      memo: input.memo,
    },
    response: { id: transfer.id, status: "pending" },
    status: "ok",
  });
  return transfer;
}

/* ---- Settlement simulation ------------------------------------------- */

/**
 * Walk the transfer list and settle anything that has had enough time to
 * "clear".  In real life Root would push webhooks; we poll a deterministic
 * clock instead.  Returns the transfers that were just settled.
 */
export function settleDueTransfers(
  state: RootState,
  now: Date = new Date(),
): RootTransfer[] {
  const settled: RootTransfer[] = [];
  for (const t of state.transfers) {
    if (t.status !== "pending") continue;
    const ageMs = now.getTime() - new Date(t.createdAt).getTime();
    // ACH debit pulls settle in ~6s of demo time; RTP disbursements ~2s;
    // ACH disbursements ~4s.
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
        // balance was debited on initiation
      }
    }
    logActivity(state, {
      endpoint: "webhook transfer.settled",
      summary: `Transfer ${t.id} settled (${t.type}, ${t.rail.toUpperCase()}, $${(t.amountCents / 100).toFixed(2)})`,
      response: { id: t.id, status: "settled" },
      status: "ok",
    });
    settled.push(t);
  }
  return settled;
}
