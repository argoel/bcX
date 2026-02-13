import { useState } from "react";
import {
  Link2,
  Link2Off,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { mockAccounts } from "../data/mock";
import type { BankAccount } from "../types";

const availableBanks = [
  { id: "chase", name: "Chase", logo: "🏦" },
  { id: "boa", name: "Bank of America", logo: "🏛️" },
  { id: "wells", name: "Wells Fargo", logo: "🐴" },
  { id: "citi", name: "Citibank", logo: "🏢" },
  { id: "capital-one", name: "Capital One", logo: "💰" },
  { id: "usaa", name: "USAA", logo: "⭐" },
  { id: "amex", name: "American Express", logo: "💳" },
  { id: "discover", name: "Discover", logo: "🔶" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));
}

type OAuthStep = "idle" | "selecting" | "authorizing" | "success";

export default function Accounts() {
  const [accounts] = useState<BankAccount[]>(mockAccounts);
  const [oauthStep, setOauthStep] = useState<OAuthStep>("idle");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  function startConnect() {
    setOauthStep("selecting");
    setSelectedBank(null);
  }

  function selectBank(bankId: string) {
    setSelectedBank(bankId);
    setOauthStep("authorizing");
    // Simulate OAuth redirect flow
    setTimeout(() => setOauthStep("success"), 2000);
  }

  function closeModal() {
    setOauthStep("idle");
    setSelectedBank(null);
  }

  const bank = availableBanks.find((b) => b.id === selectedBank);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounts</h2>
          <p className="text-sm text-gray-500 mt-1">
            Connect your bank accounts via secure OAuth
          </p>
        </div>
        <button
          onClick={startConnect}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Connect Account
        </button>
      </div>

      {/* Connected accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{acc.bankLogo}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {acc.bankName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {acc.accountType.charAt(0).toUpperCase() +
                      acc.accountType.slice(1)}{" "}
                    &middot; {acc.accountNumber}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                <Link2 size={12} /> Connected
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Balance
                </p>
                <p
                  className={`text-xl font-bold ${acc.balance >= 0 ? "text-gray-900" : "text-red-600"}`}
                >
                  {acc.balance < 0 && "-"}
                  {formatCurrency(acc.balance)}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Connected {acc.connectedAt}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex gap-3">
              <button className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <ExternalLink size={12} /> View at bank
              </button>
              <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Link2Off size={12} /> Disconnect
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* OAuth Modal */}
      {oauthStep !== "idle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {oauthStep === "selecting" && "Select Your Bank"}
                {oauthStep === "authorizing" && "Connecting..."}
                {oauthStep === "success" && "Connected!"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              {/* Step 1: Bank selection */}
              {oauthStep === "selecting" && (
                <div className="grid grid-cols-2 gap-3">
                  {availableBanks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => selectBank(b.id)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <span className="text-xl">{b.logo}</span>
                      <span className="text-sm font-medium">{b.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Simulated OAuth */}
              {oauthStep === "authorizing" && bank && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full text-3xl">
                    {bank.logo}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Redirecting to {bank.name}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      You&apos;ll authorize FinanceHub to read your account data
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <AlertCircle size={14} />
                    Simulated OAuth flow
                  </div>
                  <div className="w-48 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {oauthStep === "success" && bank && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {bank.name} connected successfully!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Your accounts and transactions are now syncing
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
