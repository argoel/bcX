import { useState } from "react";
import {
  Link2,
  Link2Off,
  Plus,
  ExternalLink,
  CheckCircle2,
  Shield,
  Lock,
  Eye,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
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

type LinkStep =
  | "idle"
  | "selecting"
  | "disclaimer"
  | "credentials"
  | "mfa"
  | "account-select"
  | "connecting"
  | "success";

interface DiscoverableAccount {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit";
  mask: string;
  selected: boolean;
}

export default function Accounts() {
  const [accounts] = useState<BankAccount[]>(mockAccounts);
  const [step, setStep] = useState<LinkStep>("idle");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Credential form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credError, setCredError] = useState("");

  // MFA state
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  // Consent state
  const [consentChecked, setConsentChecked] = useState(false);

  // Discoverable accounts state
  const [discoveredAccounts, setDiscoveredAccounts] = useState<
    DiscoverableAccount[]
  >([]);

  function startConnect() {
    setStep("selecting");
    setSelectedBank(null);
    resetForm();
  }

  function resetForm() {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setCredError("");
    setMfaCode("");
    setMfaError("");
    setConsentChecked(false);
    setDiscoveredAccounts([]);
  }

  function selectBank(bankId: string) {
    setSelectedBank(bankId);
    setStep("disclaimer");
  }

  function handleConsentContinue() {
    if (!consentChecked) return;
    setStep("credentials");
  }

  function handleCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredError("");

    if (!username.trim()) {
      setCredError("Please enter your username.");
      return;
    }
    if (!password.trim()) {
      setCredError("Please enter your password.");
      return;
    }

    // Simulate credential verification
    setStep("mfa");
  }

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMfaError("");

    if (!mfaCode.trim() || mfaCode.length < 6) {
      setMfaError("Please enter the 6-digit code.");
      return;
    }

    // Simulate account discovery
    const bank = availableBanks.find((b) => b.id === selectedBank);
    const bankName = bank?.name ?? "Bank";
    setDiscoveredAccounts([
      {
        id: "disc-1",
        name: `${bankName} Checking`,
        type: "checking",
        mask: "••••4521",
        selected: true,
      },
      {
        id: "disc-2",
        name: `${bankName} Savings`,
        type: "savings",
        mask: "••••8903",
        selected: true,
      },
      {
        id: "disc-3",
        name: `${bankName} Credit Card`,
        type: "credit",
        mask: "••••2210",
        selected: false,
      },
    ]);
    setStep("account-select");
  }

  function toggleAccountSelection(id: string) {
    setDiscoveredAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)),
    );
  }

  function handleLinkAccounts() {
    const anySelected = discoveredAccounts.some((a) => a.selected);
    if (!anySelected) return;
    setStep("connecting");
    setTimeout(() => setStep("success"), 2000);
  }

  function closeModal() {
    setStep("idle");
    setSelectedBank(null);
    resetForm();
  }

  const bank = availableBanks.find((b) => b.id === selectedBank);
  const selectedCount = discoveredAccounts.filter((a) => a.selected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounts</h2>
          <p className="text-sm text-gray-500 mt-1">
            Securely link your bank accounts to monitor transactions and manage
            payments
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

      {/* Bank Link Modal */}
      {step !== "idle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step !== "selecting" && step !== "connecting" && (
                    <button
                      onClick={() => {
                        if (step === "disclaimer") setStep("selecting");
                        else if (step === "credentials") setStep("disclaimer");
                        else if (step === "mfa") setStep("credentials");
                        else if (step === "account-select") setStep("mfa");
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 -ml-1"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <h3 className="font-semibold text-gray-900">
                    {step === "selecting" && "Select Your Bank"}
                    {step === "disclaimer" && "Before You Connect"}
                    {step === "credentials" && `Sign in to ${bank?.name ?? "your bank"}`}
                    {step === "mfa" && "Verify Your Identity"}
                    {step === "account-select" && "Choose Accounts"}
                    {step === "connecting" && "Linking Accounts..."}
                    {step === "success" && "You're All Set!"}
                  </h3>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Progress indicator */}
              {step !== "idle" && step !== "connecting" && step !== "success" && (
                <div className="flex gap-1.5 mt-3">
                  {["selecting", "disclaimer", "credentials", "mfa", "account-select"].map(
                    (s, i) => (
                      <div
                        key={s}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <=
                          ["selecting", "disclaimer", "credentials", "mfa", "account-select"].indexOf(step)
                            ? "bg-indigo-500"
                            : "bg-gray-200"
                        }`}
                      />
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Step 1: Bank selection */}
              {step === "selecting" && (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    Choose your financial institution to get started.
                  </p>
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
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                    <Lock size={12} />
                    Your credentials are encrypted end-to-end
                  </div>
                </div>
              )}

              {/* Step 2: Disclaimer / Consent */}
              {step === "disclaimer" && bank && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                    <span className="text-2xl">{bank.logo}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {bank.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Secure connection via FinanceHub
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertTriangle
                        size={20}
                        className="text-amber-600 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Important Disclosure
                        </p>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          Please review the following permissions before
                          continuing. By connecting your account, you authorize
                          FinanceHub to access your financial data.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      You are granting FinanceHub permission to:
                    </p>

                    <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <Eye
                        size={18}
                        className="text-indigo-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Monitor Transactions
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Continuously access and monitor your account
                          transactions, balances, and account details in
                          real-time. This includes all checking, savings, and
                          credit card activity.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <CreditCard
                        size={18}
                        className="text-indigo-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Automatic Payments via Direct Bank Transfer
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Initiate automatic payments and transfers directly from
                          your linked bank account using direct bank transfer
                          technology. This enables scheduled bill payments and
                          recurring transfers without manual intervention.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <Shield
                        size={18}
                        className="text-indigo-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Data Security
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Your bank credentials are encrypted and never stored on
                          our servers. You can revoke access at any time from your
                          account settings or directly through your bank.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-gray-600 leading-relaxed">
                        I understand and agree that FinanceHub will have access to
                        monitor my transaction data and the ability to initiate
                        automatic payments via direct bank transfer from my linked
                        accounts. I can revoke this access at any time.
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={handleConsentContinue}
                    disabled={!consentChecked}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      consentChecked
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Continue to Sign In <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Step 3: Credentials */}
              {step === "credentials" && bank && (
                <form onSubmit={handleCredentialSubmit} className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">{bank.logo}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {bank.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Enter your online banking credentials
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setCredError("");
                      }}
                      placeholder={`Your ${bank.name} username`}
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setCredError("");
                        }}
                        placeholder="Your banking password"
                        autoComplete="off"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>

                  {credError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> {credError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock size={14} /> Sign In Securely
                  </button>

                  <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                    <Shield size={10} />
                    Your credentials are encrypted and sent directly to{" "}
                    {bank.name}
                  </p>
                </form>
              )}

              {/* Step 4: MFA Verification */}
              {step === "mfa" && bank && (
                <form onSubmit={handleMfaSubmit} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-full">
                      <Shield size={24} className="text-indigo-500" />
                    </div>
                    <p className="text-sm text-gray-600">
                      {bank.name} sent a verification code to your phone number
                      ending in <span className="font-medium">••••47</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setMfaCode(val);
                        setMfaError("");
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.3em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {mfaError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> {mfaError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Verify
                  </button>

                  <button
                    type="button"
                    className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Resend Code
                  </button>
                </form>
              )}

              {/* Step 5: Account Selection */}
              {step === "account-select" && bank && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    We found the following accounts at {bank.name}. Select the
                    ones you&apos;d like to link.
                  </p>

                  <div className="space-y-2">
                    {discoveredAccounts.map((acct) => (
                      <button
                        key={acct.id}
                        onClick={() => toggleAccountSelection(acct.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          acct.selected
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            acct.selected
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-gray-300"
                          }`}
                        >
                          {acct.selected && (
                            <CheckCircle2 size={14} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {acct.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {acct.type.charAt(0).toUpperCase() +
                              acct.type.slice(1)}{" "}
                            &middot; {acct.mask}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleLinkAccounts}
                    disabled={selectedCount === 0}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCount > 0
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Link {selectedCount}{" "}
                    {selectedCount === 1 ? "Account" : "Accounts"}{" "}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Step 6: Connecting animation */}
              {step === "connecting" && bank && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full text-3xl">
                    {bank.logo}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Linking your {bank.name} accounts...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Setting up transaction monitoring and payment access
                    </p>
                  </div>
                  <div className="w-48 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              )}

              {/* Step 7: Success */}
              {step === "success" && bank && (
                <div className="text-center py-6 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {bank.name} connected successfully!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedCount}{" "}
                      {selectedCount === 1 ? "account has" : "accounts have"}{" "}
                      been linked
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Transaction monitoring is active
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Direct bank transfer payments enabled
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Real-time balance syncing
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Lock size={10} />
              Secured by FinanceHub &middot; 256-bit encryption
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
