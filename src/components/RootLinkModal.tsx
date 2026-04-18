/* ────────────────────────────────────────────────────────────────────────
   RootLinkModal.tsx

   A UI simulation of the Root JS SDK bank-link flow.  In a real
   integration this modal would be rendered by
   `rootPay.openBankLink({ onSuccess })` from the `root-pay-js-sdk`; we
   embed a visually-similar experience so the end-to-end demo feels
   authentic.

   The modal accepts either "employer" or "employee" mode and resolves
   with the selected bank + (for employer) an explicit ACH debit
   authorization.
   ──────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  X,
  Building2,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from "lucide-react";

const banks = [
  { id: "chase", name: "Chase", logo: "🏦", color: "#117ACA" },
  { id: "boa", name: "Bank of America", logo: "🏛️", color: "#012169" },
  { id: "wells", name: "Wells Fargo", logo: "🐴", color: "#D71E28" },
  { id: "citi", name: "Citibank", logo: "🏢", color: "#056DAE" },
  { id: "svb", name: "Silicon Valley Bank", logo: "🌁", color: "#1a7f37" },
  { id: "usbank", name: "US Bank", logo: "🏦", color: "#0F2550" },
];

export type LinkResult = {
  bankName: string;
  accountType: "checking" | "savings";
  last4: string;
  achDebitAuthorized: boolean;
};

export default function RootLinkModal({
  mode,
  open,
  onClose,
  onLinked,
  title,
}: {
  mode: "employer" | "employee";
  open: boolean;
  onClose: () => void;
  onLinked: (result: LinkResult) => void;
  title?: string;
}) {
  type Step =
    | "pick-bank"
    | "credentials"
    | "pick-account"
    | "authorize"
    | "linking"
    | "success";
  const [step, setStep] = useState<Step>("pick-bank");
  const [bankId, setBankId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">(
    "checking",
  );
  const [last4, setLast4] = useState(
    () => String(1000 + Math.floor(Math.random() * 9000)).padStart(4, "0"),
  );
  const [authorized, setAuthorized] = useState(false);

  const bank = banks.find((b) => b.id === bankId);

  function reset() {
    setStep("pick-bank");
    setBankId(null);
    setUsername("");
    setPassword("");
    setAccountType("checking");
    setLast4(String(1000 + Math.floor(Math.random() * 9000)).padStart(4, "0"));
    setAuthorized(false);
  }

  function closeAndReset() {
    reset();
    onClose();
  }

  function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setStep("pick-account");
  }

  function finishLink() {
    setStep("linking");
    setTimeout(() => {
      setStep("success");
      setTimeout(() => {
        if (!bank) return;
        onLinked({
          bankName: bank.name,
          accountType,
          last4,
          achDebitAuthorized: mode === "employer" ? authorized : false,
        });
        reset();
      }, 700);
    }, 900);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Branded Root header */}
        <div
          className="px-5 py-3 text-white flex items-center justify-between"
          style={{
            background:
              "linear-gradient(135deg, #0f172a 0%, #4338ca 60%, #7c3aed 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            {step !== "pick-bank" && step !== "linking" && step !== "success" && (
              <button
                onClick={() => {
                  if (step === "credentials") setStep("pick-bank");
                  else if (step === "pick-account") setStep("credentials");
                  else if (step === "authorize") setStep("pick-account");
                }}
                className="p-1 -ml-1 rounded hover:bg-white/10"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <span className="text-sm font-semibold tracking-wide">
              Root · Bank Link
            </span>
          </div>
          <button
            onClick={closeAndReset}
            className="p-1 rounded hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 -mt-1">
            {title ??
              (mode === "employer"
                ? "Link your company's operating bank account"
                : "Link employee's payout account")}
          </p>

          {/* Step 1: pick bank */}
          {step === "pick-bank" && (
            <div className="grid grid-cols-2 gap-2">
              {banks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBankId(b.id);
                    setStep("credentials");
                  }}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
                >
                  <span className="text-lg">{b.logo}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {b.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: credentials */}
          {step === "credentials" && bank && (
            <form onSubmit={submitCredentials} className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <span className="text-lg">{bank.logo}</span>
                <span className="text-sm font-medium">{bank.name}</span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Online banking username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!username || !password}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
              >
                Sign in
              </button>
              <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock size={10} /> Credentials never leave Root · end-to-end
                encrypted
              </p>
            </form>
          )}

          {/* Step 3: pick account */}
          {step === "pick-account" && bank && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Which {bank.name} account should we link?
              </p>
              <div className="space-y-2">
                {(["checking", "savings"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAccountType(t)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      accountType === t
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="text-sm font-medium capitalize">
                        {t}
                      </span>
                      <span className="text-xs text-gray-400">
                        ••{last4}
                      </span>
                    </div>
                    {accountType === t && (
                      <CheckCircle2
                        size={16}
                        className="text-indigo-600"
                      />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (mode === "employer") setStep("authorize");
                  else finishLink();
                }}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 4: employer ACH debit auth */}
          {step === "authorize" && bank && (
            <div className="space-y-3">
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-900 space-y-2">
                <p className="font-semibold">ACH Debit Authorization</p>
                <p>
                  I, the payroll admin of the linked company, authorize myPay to
                  initiate <span className="font-semibold">ACH debit pulls</span>{" "}
                  from this {bank.name} account (••{last4}) to prefund the
                  myPay Root subaccount used to pay our employees.
                </p>
                <p>
                  Debits occur only when I explicitly approve them in the
                  myPay Funding screen.  Authorization can be revoked at any
                  time.
                </p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs text-gray-700">
                  I agree to the ACH debit authorization for {bank.name} ••
                  {last4}.
                </span>
              </label>
              <button
                onClick={finishLink}
                disabled={!authorized}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
              >
                Authorize &amp; Link
              </button>
            </div>
          )}

          {/* Step 5: linking spinner */}
          {step === "linking" && (
            <div className="text-center py-8 space-y-3">
              <Loader2
                size={28}
                className="mx-auto text-indigo-600 animate-spin"
              />
              <p className="text-sm text-gray-600">
                Tokenizing account with Root…
              </p>
            </div>
          )}

          {/* Step 6: success */}
          {step === "success" && bank && (
            <div className="text-center py-6 space-y-2">
              <div className="inline-flex w-12 h-12 rounded-full bg-emerald-50 items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold">Account linked!</p>
              <p className="text-xs text-gray-500">
                {bank.name} {accountType} ••{last4}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-center gap-1">
          <ShieldCheck size={10} /> Powered by Root · sandbox environment
        </div>
      </div>
    </div>
  );
}
