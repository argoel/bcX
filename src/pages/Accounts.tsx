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
  EyeOff,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { mockAccounts } from "../data/mock";
import type { BankAccount } from "../types";

/* ------------------------------------------------------------------ */
/*  Per-bank brand configuration                                       */
/* ------------------------------------------------------------------ */

interface BankBrand {
  id: string;
  name: string;
  logo: string;
  /** Primary brand color */
  primary: string;
  /** Hovered / darker variant */
  primaryHover: string;
  /** Very light tint for backgrounds */
  primaryLight: string;
  /** Text color on light bg */
  primaryText: string;
  /** Header bg gradient (from -> to) */
  headerFrom: string;
  headerTo: string;
  /** Header text color */
  headerText: string;
  /** Login field labels */
  usernameLabel: string;
  passwordLabel: string;
  /** Placeholder text */
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  /** Sign-in button text */
  signInText: string;
  /** MFA prompt */
  mfaPrompt: string;
  /** MFA method label (e.g. "SafePass", "Secure Access Code") */
  mfaLabel: string;
  /** Welcome / tagline text shown on credentials page */
  tagline: string;
  /** Discovered account names */
  accountNames: [string, string, string];
}

const bankBrands: Record<string, BankBrand> = {
  chase: {
    id: "chase",
    name: "Chase",
    logo: "🏦",
    primary: "#117ACA",
    primaryHover: "#0C5FA0",
    primaryLight: "#E8F4FD",
    primaryText: "#0A4D80",
    headerFrom: "#117ACA",
    headerTo: "#0C5FA0",
    headerText: "#ffffff",
    usernameLabel: "User ID",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your Chase user ID",
    passwordPlaceholder: "Enter your password",
    signInText: "Sign In",
    mfaPrompt:
      "We sent a text message with a one-time code to your phone ending in",
    mfaLabel: "Identification Code",
    tagline: "Welcome to Chase Online",
    accountNames: ["Chase Total Checking", "Chase Savings", "Chase Freedom"],
  },
  boa: {
    id: "boa",
    name: "Bank of America",
    logo: "🏛️",
    primary: "#012169",
    primaryHover: "#001142",
    primaryLight: "#E6EAF3",
    primaryText: "#012169",
    headerFrom: "#012169",
    headerTo: "#E31837",
    headerText: "#ffffff",
    usernameLabel: "Online ID",
    passwordLabel: "Passcode",
    usernamePlaceholder: "Enter your Online ID",
    passwordPlaceholder: "Enter your passcode",
    signInText: "Sign In",
    mfaPrompt: "We sent a SafePass code to your mobile device ending in",
    mfaLabel: "SafePass Code",
    tagline: "Sign in to Online Banking",
    accountNames: [
      "Advantage Checking",
      "Advantage Savings",
      "BankAmericard",
    ],
  },
  wells: {
    id: "wells",
    name: "Wells Fargo",
    logo: "🐴",
    primary: "#D71E28",
    primaryHover: "#B2161F",
    primaryLight: "#FFF0F0",
    primaryText: "#D71E28",
    headerFrom: "#D71E28",
    headerTo: "#FFCD11",
    headerText: "#ffffff",
    usernameLabel: "Username",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your username",
    passwordPlaceholder: "Enter your password",
    signInText: "Sign On",
    mfaPrompt:
      "We sent a temporary access code to your phone number ending in",
    mfaLabel: "Access Code",
    tagline: "Welcome to Wells Fargo Online",
    accountNames: [
      "Everyday Checking",
      "Way2Save Savings",
      "Active Cash Card",
    ],
  },
  citi: {
    id: "citi",
    name: "Citibank",
    logo: "🏢",
    primary: "#056DAE",
    primaryHover: "#045A91",
    primaryLight: "#E6F1F9",
    primaryText: "#056DAE",
    headerFrom: "#056DAE",
    headerTo: "#003B70",
    headerText: "#ffffff",
    usernameLabel: "User ID",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your Citi user ID",
    passwordPlaceholder: "Enter your password",
    signInText: "Sign On",
    mfaPrompt:
      "A security code has been sent to your registered phone ending in",
    mfaLabel: "Security Code",
    tagline: "Sign on to Citibank Online",
    accountNames: [
      "Citi Priority Checking",
      "Citi Accelerate Savings",
      "Citi Double Cash",
    ],
  },
  "capital-one": {
    id: "capital-one",
    name: "Capital One",
    logo: "💰",
    primary: "#004879",
    primaryHover: "#003659",
    primaryLight: "#E6EFF5",
    primaryText: "#004879",
    headerFrom: "#004879",
    headerTo: "#D03027",
    headerText: "#ffffff",
    usernameLabel: "Username",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your username",
    passwordPlaceholder: "Enter your password",
    signInText: "Sign In",
    mfaPrompt:
      "We sent a verification code to the phone number on file ending in",
    mfaLabel: "Verification Code",
    tagline: "Sign in to Capital One",
    accountNames: [
      "360 Checking",
      "360 Performance Savings",
      "Venture Rewards",
    ],
  },
  usaa: {
    id: "usaa",
    name: "USAA",
    logo: "⭐",
    primary: "#00529B",
    primaryHover: "#003D74",
    primaryLight: "#E6F0F8",
    primaryText: "#00529B",
    headerFrom: "#00529B",
    headerTo: "#003F77",
    headerText: "#ffffff",
    usernameLabel: "Online ID",
    passwordLabel: "PIN",
    usernamePlaceholder: "Enter your USAA Online ID",
    passwordPlaceholder: "Enter your PIN",
    signInText: "Log On",
    mfaPrompt: "A security code was sent to your phone ending in",
    mfaLabel: "Security Code",
    tagline: "Log on to USAA",
    accountNames: [
      "USAA Classic Checking",
      "USAA Savings",
      "USAA Cashback Rewards",
    ],
  },
  amex: {
    id: "amex",
    name: "American Express",
    logo: "💳",
    primary: "#006FCF",
    primaryHover: "#005BAA",
    primaryLight: "#E6F2FC",
    primaryText: "#006FCF",
    headerFrom: "#006FCF",
    headerTo: "#004C8E",
    headerText: "#ffffff",
    usernameLabel: "User ID",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your User ID",
    passwordPlaceholder: "Enter your password",
    signInText: "Log In",
    mfaPrompt:
      "We sent a one-time verification code to your mobile number ending in",
    mfaLabel: "One-Time Code",
    tagline: "Log in to your Account",
    accountNames: [
      "Amex Platinum Card",
      "Amex High Yield Savings",
      "Amex Blue Cash",
    ],
  },
  discover: {
    id: "discover",
    name: "Discover",
    logo: "🔶",
    primary: "#FF6000",
    primaryHover: "#D95000",
    primaryLight: "#FFF3EB",
    primaryText: "#CC4D00",
    headerFrom: "#FF6000",
    headerTo: "#D95000",
    headerText: "#ffffff",
    usernameLabel: "User ID",
    passwordLabel: "Password",
    usernamePlaceholder: "Enter your Discover User ID",
    passwordPlaceholder: "Enter your password",
    signInText: "Log In",
    mfaPrompt:
      "Discover sent a verification code to your phone number ending in",
    mfaLabel: "Verification Code",
    tagline: "Sign in to Discover Online",
    accountNames: [
      "Discover Cashback Checking",
      "Discover Online Savings",
      "Discover it Card",
    ],
  },
};

const availableBanks = Object.values(bankBrands);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

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

  const brand: BankBrand | null = selectedBankId
    ? bankBrands[selectedBankId] ?? null
    : null;

  /* ---- actions --------------------------------------------------- */

  function startConnect() {
    setStep("selecting");
    setSelectedBankId(null);
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
    setSelectedBankId(bankId);
    setStep("disclaimer");
  }

  function handleConsentContinue() {
    if (!consentChecked) return;
    setStep("credentials");
  }

  function handleCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredError("");
    if (!brand) return;

    if (!username.trim()) {
      setCredError(`Please enter your ${brand.usernameLabel}.`);
      return;
    }
    if (!password.trim()) {
      setCredError(`Please enter your ${brand.passwordLabel}.`);
      return;
    }

    setStep("mfa");
  }

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMfaError("");
    if (!brand) return;

    if (!mfaCode.trim() || mfaCode.length < 6) {
      setMfaError(`Please enter the 6-digit ${brand.mfaLabel}.`);
      return;
    }

    setDiscoveredAccounts([
      {
        id: "disc-1",
        name: brand.accountNames[0],
        type: "checking",
        mask: "••••4521",
        selected: true,
      },
      {
        id: "disc-2",
        name: brand.accountNames[1],
        type: "savings",
        mask: "••••8903",
        selected: true,
      },
      {
        id: "disc-3",
        name: brand.accountNames[2],
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
    setSelectedBankId(null);
    resetForm();
  }

  const selectedCount = discoveredAccounts.filter((a) => a.selected).length;

  /* ---- helpers for branded inline styles ------------------------- */

  const btnStyle = brand
    ? { backgroundColor: brand.primary, color: "#fff" }
    : {};
  const btnHoverBg = brand ? brand.primaryHover : undefined;

  function BrandButton({
    children,
    disabled,
    onClick,
    type,
    className = "",
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: "submit" | "button";
    className?: string;
  }) {
    const [hovered, setHovered] = useState(false);
    return (
      <button
        type={type ?? "button"}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={
          disabled
            ? {}
            : {
                backgroundColor:
                  hovered && btnHoverBg ? btnHoverBg : brand?.primary,
                color: "#fff",
              }
        }
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
        } ${className}`}
      >
        {children}
      </button>
    );
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

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

      {/* ============================================================ */}
      {/*  Bank Link Modal                                              */}
      {/* ============================================================ */}
      {step !== "idle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* ---- Branded header ---------------------------------- */}
            {step === "selecting" ? (
              /* generic header for bank picker */
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    Select Your Bank
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ) : brand ? (
              /* bank-branded header */
              <div
                style={{
                  background: `linear-gradient(135deg, ${brand.headerFrom}, ${brand.headerTo})`,
                  color: brand.headerText,
                }}
              >
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {step !== "connecting" && step !== "success" && (
                        <button
                          onClick={() => {
                            if (step === "disclaimer") setStep("selecting");
                            else if (step === "credentials")
                              setStep("disclaimer");
                            else if (step === "mfa") setStep("credentials");
                            else if (step === "account-select") setStep("mfa");
                          }}
                          className="p-1 -ml-1 rounded hover:bg-white/20 transition-colors"
                          style={{ color: brand.headerText }}
                        >
                          <ArrowLeft size={16} />
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{brand.logo}</span>
                        <span className="font-semibold">{brand.name}</span>
                      </div>
                    </div>
                    <button
                      onClick={closeModal}
                      className="hover:bg-white/20 rounded p-1 text-xl leading-none transition-colors"
                      style={{ color: brand.headerText }}
                    >
                      &times;
                    </button>
                  </div>

                  {/* progress bar */}
                  {step !== "connecting" && step !== "success" && (
                    <div className="flex gap-1.5 mt-3">
                      {[
                        "disclaimer",
                        "credentials",
                        "mfa",
                        "account-select",
                      ].map((s, i) => (
                        <div
                          key={s}
                          className="h-1 flex-1 rounded-full transition-colors"
                          style={{
                            backgroundColor:
                              i <=
                              [
                                "disclaimer",
                                "credentials",
                                "mfa",
                                "account-select",
                              ].indexOf(step)
                                ? "#ffffff"
                                : "rgba(255,255,255,0.3)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="p-6">
              {/* Step 1: Bank selection ----------------------------- */}
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
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:shadow-md transition-all text-left group"
                      >
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                          style={{ backgroundColor: b.primaryLight }}
                        >
                          {b.logo}
                        </span>
                        <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                          {b.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                    <Lock size={12} />
                    Your credentials are encrypted end-to-end
                  </div>
                </div>
              )}

              {/* Step 2: Disclaimer / Consent ---------------------- */}
              {step === "disclaimer" && brand && (
                <div className="space-y-4">
                  <p
                    className="text-sm font-medium"
                    style={{ color: brand.primaryText }}
                  >
                    {brand.name} requires your permission to share data with
                    FinanceHub.
                  </p>

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
                          continuing. By connecting your {brand.name} account,
                          you authorize FinanceHub to access your financial data.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      You are granting FinanceHub permission to:
                    </p>

                    <div
                      className="flex gap-3 items-start p-3 rounded-lg"
                      style={{ backgroundColor: brand.primaryLight }}
                    >
                      <Eye
                        size={18}
                        className="shrink-0 mt-0.5"
                        style={{ color: brand.primary }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Monitor Transactions
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Continuously access and monitor your {brand.name}{" "}
                          transactions, balances, and account details in
                          real-time. This includes all checking, savings, and
                          credit card activity.
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex gap-3 items-start p-3 rounded-lg"
                      style={{ backgroundColor: brand.primaryLight }}
                    >
                      <CreditCard
                        size={18}
                        className="shrink-0 mt-0.5"
                        style={{ color: brand.primary }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Automatic Payments via Direct Bank Transfer
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Initiate automatic payments and transfers directly from
                          your linked {brand.name} account using direct bank
                          transfer technology. This enables scheduled bill
                          payments and recurring transfers.
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex gap-3 items-start p-3 rounded-lg"
                      style={{ backgroundColor: brand.primaryLight }}
                    >
                      <Shield
                        size={18}
                        className="shrink-0 mt-0.5"
                        style={{ color: brand.primary }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Data Security
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Your {brand.name} credentials are encrypted and never
                          stored on our servers. You can revoke access at any
                          time from your account settings or directly through{" "}
                          {brand.name}.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        style={{ accentColor: brand.primary }}
                      />
                      <span className="text-xs text-gray-600 leading-relaxed">
                        I understand and agree that FinanceHub will have access
                        to monitor my {brand.name} transaction data and the
                        ability to initiate automatic payments via direct bank
                        transfer from my linked accounts. I can revoke this
                        access at any time.
                      </span>
                    </label>
                  </div>

                  <BrandButton
                    disabled={!consentChecked}
                    onClick={handleConsentContinue}
                  >
                    Continue to {brand.name} Sign In <ArrowRight size={14} />
                  </BrandButton>
                </div>
              )}

              {/* Step 3: Credentials ------------------------------- */}
              {step === "credentials" && brand && (
                <form onSubmit={handleCredentialSubmit} className="space-y-5">
                  {/* Bank-branded hero */}
                  <div className="text-center pb-2">
                    <p
                      className="text-lg font-semibold"
                      style={{ color: brand.primaryText }}
                    >
                      {brand.tagline}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your {brand.name} online banking credentials
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: brand.primaryText }}
                    >
                      {brand.usernameLabel}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setCredError("");
                      }}
                      placeholder={brand.usernamePlaceholder}
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={
                        {
                          "--tw-ring-color": brand.primary,
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: brand.primaryText }}
                    >
                      {brand.passwordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setCredError("");
                        }}
                        placeholder={brand.passwordPlaceholder}
                        autoComplete="off"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent pr-10"
                        style={
                          {
                            "--tw-ring-color": brand.primary,
                          } as React.CSSProperties
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {credError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> {credError}
                    </p>
                  )}

                  <BrandButton type="submit">
                    <Lock size={14} /> {brand.signInText}
                  </BrandButton>

                  <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                    <Shield size={10} />
                    Your credentials are encrypted and sent directly to{" "}
                    {brand.name}
                  </p>
                </form>
              )}

              {/* Step 4: MFA Verification -------------------------- */}
              {step === "mfa" && brand && (
                <form onSubmit={handleMfaSubmit} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div
                      className="inline-flex items-center justify-center w-14 h-14 rounded-full"
                      style={{ backgroundColor: brand.primaryLight }}
                    >
                      <Shield size={24} style={{ color: brand.primary }} />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {brand.mfaPrompt}{" "}
                      <span className="font-medium">••••47</span>
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: brand.primaryText }}
                    >
                      {brand.mfaLabel}
                    </label>
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setMfaCode(val);
                        setMfaError("");
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.3em] font-mono text-lg focus:outline-none focus:ring-2 focus:border-transparent"
                      style={
                        {
                          "--tw-ring-color": brand.primary,
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  {mfaError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> {mfaError}
                    </p>
                  )}

                  <BrandButton type="submit">Verify</BrandButton>

                  <button
                    type="button"
                    className="w-full text-sm font-medium"
                    style={{ color: brand.primary }}
                  >
                    Resend {brand.mfaLabel}
                  </button>
                </form>
              )}

              {/* Step 5: Account Selection ------------------------- */}
              {step === "account-select" && brand && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    We found the following accounts at {brand.name}. Select the
                    ones you&apos;d like to link.
                  </p>

                  <div className="space-y-2">
                    {discoveredAccounts.map((acct) => (
                      <button
                        key={acct.id}
                        onClick={() => toggleAccountSelection(acct.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors"
                        style={{
                          borderColor: acct.selected
                            ? brand.primary
                            : "#e5e7eb",
                          backgroundColor: acct.selected
                            ? brand.primaryLight
                            : "transparent",
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: acct.selected
                              ? brand.primary
                              : "transparent",
                            borderColor: acct.selected
                              ? brand.primary
                              : "#d1d5db",
                          }}
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

                  <BrandButton
                    disabled={selectedCount === 0}
                    onClick={handleLinkAccounts}
                  >
                    Link {selectedCount}{" "}
                    {selectedCount === 1 ? "Account" : "Accounts"}{" "}
                    <ArrowRight size={14} />
                  </BrandButton>
                </div>
              )}

              {/* Step 6: Connecting animation ----------------------- */}
              {step === "connecting" && brand && (
                <div className="text-center py-8 space-y-4">
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl"
                    style={{ backgroundColor: brand.primaryLight }}
                  >
                    {brand.logo}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Linking your {brand.name} accounts...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Setting up transaction monitoring and payment access
                    </p>
                  </div>
                  <div className="w-48 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-pulse w-3/4"
                      style={{ backgroundColor: brand.primary }}
                    />
                  </div>
                </div>
              )}

              {/* Step 7: Success ----------------------------------- */}
              {step === "success" && brand && (
                <div className="text-center py-6 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {brand.name} connected successfully!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedCount}{" "}
                      {selectedCount === 1 ? "account has" : "accounts have"}{" "}
                      been linked
                    </p>
                  </div>

                  <div
                    className="rounded-lg p-4 text-left space-y-2 text-xs"
                    style={{
                      backgroundColor: brand.primaryLight,
                      color: brand.primaryText,
                    }}
                  >
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

                  <BrandButton onClick={closeModal}>Done</BrandButton>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-3 border-t flex items-center justify-center gap-2 text-xs"
              style={{
                backgroundColor: brand ? brand.primaryLight : "#f9fafb",
                borderColor: brand ? `${brand.primary}20` : "#f3f4f6",
                color: brand ? brand.primaryText : "#9ca3af",
              }}
            >
              <Lock size={10} />
              {brand
                ? `Secured connection to ${brand.name} · 256-bit encryption`
                : "Secured by FinanceHub · 256-bit encryption"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
