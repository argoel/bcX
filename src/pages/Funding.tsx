import { useState } from "react";
import {
  Wallet,
  ArrowDownCircle,
  Banknote,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useActiveTenant, useStore } from "../state/store";
import { fmtUsd, toCents } from "../lib/money";
import { grossPerPeriodCents } from "../lib/payroll";
import { applyTransfer, rootClient } from "../services/root";

export default function Funding() {
  const { state, update } = useStore();
  const tenant = useActiveTenant();
  const [amount, setAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tenant) return null;
  const { employer, employees } = tenant;
  const sub = state.root.subaccounts[employer.rootSubaccountId];

  const employerBanks = Object.values(state.root.bankTokens).filter(
    (b) =>
      b.ownerType === "employer" &&
      b.ownerId === employer.id &&
      b.achDebitAuthorized,
  );
  const primary = employerBanks[0];

  // Suggested amount = sum of next period's gross for bank-linked employees.
  const suggestedCents = employees
    .filter((e) => e.rootBankToken)
    .reduce((sum, e) => sum + grossPerPeriodCents(e), 0);

  const recentDebits = state.root.transfers
    .filter((t) => t.type === "debit-in")
    .slice(0, 10);

  async function pull() {
    setError(null);
    if (!primary) {
      setError(
        "No authorized company bank found. Link one on the Company Bank page first.",
      );
      return;
    }
    const amountCents = toCents(amount);
    if (amountCents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    // Re-capture to keep TS narrowing through the async await points.
    const { rootSubaccountId, companyName } = employer;
    const subaccount = state.root.subaccounts[rootSubaccountId];
    if (!subaccount) {
      setError("Subaccount not found.");
      return;
    }
    setSubmitting(true);
    try {
      const out = await rootClient.initiateAchDebit(
        {
          subaccountId: rootSubaccountId,
          employerBankTokenId: primary.id,
          amountCents,
          memo: `myPay prefunding — ${companyName}`,
        },
        { subaccount, bank: primary },
      );
      update((draft) => applyTransfer(draft.root, out));
      setAmount(0);
    } catch (err) {
      setError((err as Error).message);
    }
    setSubmitting(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Funding</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prefund your Root subaccount via ACH debit pull from your company
          bank.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowDownCircle size={16} className="text-indigo-600" />
            Pull funds from company bank → subaccount
          </div>

          {!primary ? (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-medium">No authorized bank.</p>
              <p className="text-xs mt-1">
                Head to the{" "}
                <Link
                  to="/company-bank"
                  className="underline font-medium"
                >
                  Company Bank
                </Link>{" "}
                page to link an account and authorize ACH debits.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Banknote size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{primary.bankName}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {primary.accountType} ••{primary.last4}
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  ACH authorized
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Amount (USD)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) =>
                      setAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {suggestedCents > 0 && (
                    <button
                      onClick={() => setAmount(suggestedCents / 100)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-md px-3 py-2"
                    >
                      Use {fmtUsd(suggestedCents)}
                    </button>
                  )}
                </div>
                {suggestedCents > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Suggested = next period's total gross for bank-linked
                    employees.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}

              <button
                onClick={pull}
                disabled={submitting || !amount}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <ArrowDownCircle size={14} />
                    Initiate ACH debit pull
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wallet size={16} className="text-emerald-600" /> Subaccount
          </div>
          <p className="text-2xl font-bold mt-3">
            {sub ? fmtUsd(sub.balanceCents) : "—"}
          </p>
          <p className="text-xs text-gray-400">Available balance</p>
          {sub && sub.pendingInCents > 0 && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-flex items-center gap-1">
              <Clock size={12} /> {fmtUsd(sub.pendingInCents)} pending in
            </p>
          )}
          {sub && sub.pendingOutCents > 0 && (
            <p className="mt-1 text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1 inline-flex items-center gap-1">
              <Clock size={12} /> {fmtUsd(sub.pendingOutCents)} pending out
            </p>
          )}
        </div>
      </div>

      {/* Recent debits */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            Recent ACH debit pulls
          </h3>
        </div>
        {recentDebits.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No funding transfers yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Initiated</th>
                <th className="text-left px-5 py-2.5 font-medium">Bank</th>
                <th className="text-left px-5 py-2.5 font-medium">Amount</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDebits.map((t) => {
                const b = state.root.bankTokens[t.bankTokenId];
                return (
                  <tr key={t.id}>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      {b ? `${b.bankName} ••${b.last4}` : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold">
                      {fmtUsd(t.amountCents)}
                    </td>
                    <td className="px-5 py-3">
                      <TransferStatus status={t.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function TransferStatus({
  status,
}: {
  status: "pending" | "settled" | "failed";
}) {
  if (status === "settled")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={12} /> Settled
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock size={12} /> Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <AlertCircle size={12} /> Failed
    </span>
  );
}
