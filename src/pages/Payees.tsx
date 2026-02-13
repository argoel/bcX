import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ShieldCheck,
  Building2,
  ChevronRight,
  User,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Eye,
  EyeOff,
  BadgeCheck,
} from "lucide-react";
import { mockPayees } from "../data/mock";
import type { Payee } from "../types";

/* ── helpers ─────────────────────────────────────────────────────────── */

function maskAccount(num: string) {
  return "••••" + num.slice(-4);
}

function formatRouting(r: string) {
  return r.replace(/(\d{4})(\d{4})(\d)/, "$1-$2-$3");
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* Simulated routing-number → bank-name lookup */
const routingBankMap: Record<string, string> = {
  "021000021": "JPMorgan Chase",
  "021001088": "Bank of New York Mellon",
  "021200339": "Citibank",
  "026009593": "TD Bank",
  "031100157": "PNC Bank",
  "052001633": "SunTrust Bank",
  "061000052": "Bank of America",
  "071000013": "BMO Harris Bank",
  "091000019": "US Bank",
  "121000248": "Wells Fargo",
  "121000358": "Bank of America",
  "121042882": "Wells Fargo",
  "122000247": "Wells Fargo",
  "122000661": "Bank of America",
  "267084131": "USAA Federal Savings",
  "322271627": "JPMorgan Chase",
};

function lookupBank(routing: string): string | null {
  return routingBankMap[routing] ?? null;
}

/* ── verification steps ──────────────────────────────────────────────── */

type VerifStep = "idle" | "routing" | "account" | "micro" | "done" | "failed";
const verifLabels: Record<VerifStep, string> = {
  idle: "",
  routing: "Validating routing number...",
  account: "Verifying account number...",
  micro: "Sending micro-deposits for confirmation...",
  done: "Account verified successfully",
  failed: "Verification failed",
};

/* ── component ───────────────────────────────────────────────────────── */

const emptyForm = {
  name: "",
  nickname: "",
  accountNumber: "",
  accountNumberConfirm: "",
  routingNumber: "",
  accountType: "checking" as "checking" | "savings",
  email: "",
  phone: "",
  address: "",
};

type PayeeForm = typeof emptyForm;

export default function Payees() {
  const [payees, setPayees] = useState<Payee[]>(mockPayees);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "failed">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PayeeForm>(emptyForm);
  const [verifStep, setVerifStep] = useState<VerifStep>("idle");
  const [resolvedBank, setResolvedBank] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [detailPayee, setDetailPayee] = useState<Payee | null>(null);
  const [showDetailAccount, setShowDetailAccount] = useState(false);

  /* ── routing number live-lookup ───── */
  useEffect(() => {
    if (form.routingNumber.length === 9) {
      const bank = lookupBank(form.routingNumber);
      setResolvedBank(bank);
    } else {
      setResolvedBank(null);
    }
  }, [form.routingNumber]);

  /* ── field updater ───── */
  const set = useCallback(
    <K extends keyof PayeeForm>(key: K, val: PayeeForm[K]) =>
      setForm((f) => ({ ...f, [key]: val })),
    []
  );

  /* ── filter / search ───── */
  const filtered = payees.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nickname?.toLowerCase().includes(q) ?? false) ||
        p.bankName.toLowerCase().includes(q) ||
        p.accountNumber.slice(-4).includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: payees.length,
    verified: payees.filter((p) => p.status === "verified").length,
    pending: payees.filter((p) => p.status === "pending").length,
    failed: payees.filter((p) => p.status === "failed").length,
  };

  /* ── open add / edit ───── */
  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setVerifStep("idle");
    setResolvedBank(null);
    setShowAccount(false);
    setShowForm(true);
  }

  function openEdit(p: Payee) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      nickname: p.nickname ?? "",
      accountNumber: p.accountNumber,
      accountNumberConfirm: p.accountNumber,
      routingNumber: p.routingNumber,
      accountType: p.accountType,
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
    });
    setResolvedBank(p.bankName);
    setVerifStep(p.status === "verified" ? "done" : "idle");
    setShowAccount(false);
    setShowForm(true);
  }

  /* ── instant verification simulation ───── */
  async function runVerification() {
    const steps: VerifStep[] = ["routing", "account", "micro", "done"];
    for (const step of steps) {
      setVerifStep(step);
      await new Promise((r) => setTimeout(r, step === "micro" ? 2200 : 1200));
      // simulate rare failure
      if (step === "account" && form.accountNumber.startsWith("000")) {
        setVerifStep("failed");
        return false;
      }
    }
    return true;
  }

  async function savePayee() {
    // validation
    if (!form.name || !form.accountNumber || !form.routingNumber) return;
    if (form.routingNumber.length !== 9) return;
    if (form.accountNumber !== form.accountNumberConfirm) return;

    // run verification for new payees or if account details changed
    const existing = editingId ? payees.find((p) => p.id === editingId) : null;
    const accountChanged =
      !existing ||
      existing.accountNumber !== form.accountNumber ||
      existing.routingNumber !== form.routingNumber;

    let verified = !accountChanged;
    if (accountChanged) {
      verified = await runVerification();
    }

    const now = new Date().toISOString().slice(0, 10);
    const payee: Payee = {
      id: editingId ?? `payee-${Date.now()}`,
      name: form.name,
      nickname: form.nickname || undefined,
      accountNumber: form.accountNumber,
      routingNumber: form.routingNumber,
      bankName: resolvedBank ?? "Unknown Bank",
      accountType: form.accountType,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      status: verified ? "verified" : "failed",
      verifiedAt: verified ? now : undefined,
      createdAt: existing?.createdAt ?? now,
      lastPaymentDate: existing?.lastPaymentDate,
      totalPayments: existing?.totalPayments ?? 0,
    };

    if (editingId) {
      setPayees((prev) => prev.map((p) => (p.id === editingId ? payee : p)));
    } else {
      setPayees((prev) => [...prev, payee]);
    }

    if (verified) {
      // auto-close after showing success for a moment
      setTimeout(() => setShowForm(false), 800);
    }
  }

  function deletePayee(id: string) {
    setPayees((prev) => prev.filter((p) => p.id !== id));
  }

  /* ── status badge ───── */
  function StatusBadge({ status }: { status: Payee["status"] }) {
    if (status === "verified")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={12} /> Verified
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

  /* ── verification progress UI ───── */
  function VerificationProgress() {
    if (verifStep === "idle") return null;
    const steps: { key: VerifStep; label: string }[] = [
      { key: "routing", label: "Routing Number" },
      { key: "account", label: "Account Number" },
      { key: "micro", label: "Micro-Deposit" },
    ];
    const currentIdx = steps.findIndex((s) => s.key === verifStep);
    const isDone = verifStep === "done";
    const isFailed = verifStep === "failed";

    return (
      <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          {isDone ? (
            <ShieldCheck size={18} className="text-emerald-600" />
          ) : isFailed ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : (
            <Loader2 size={18} className="text-indigo-600 animate-spin" />
          )}
          {verifLabels[verifStep]}
        </div>

        {/* step indicators */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const isActive = s.key === verifStep;
            const isCompleted = isDone || (!isFailed && currentIdx > i);
            const isFailedStep = isFailed && s.key === verifStep;
            return (
              <div key={s.key} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isActive
                      ? "bg-indigo-500 animate-pulse"
                      : isFailedStep
                      ? "bg-red-500"
                      : "bg-gray-200"
                  }`}
                />
                <p
                  className={`text-[10px] mt-1 ${
                    isActive || isCompleted
                      ? "text-gray-700 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            <BadgeCheck size={16} />
            Account is ready to receive payments. You can now use this payee for bill payments.
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg">
            <AlertCircle size={16} />
            We couldn't verify this account. Please double-check the account and routing numbers.
          </div>
        )}
      </div>
    );
  }

  /* ── Payee detail panel ───── */
  function DetailPanel({ p }: { p: Payee }) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          {/* header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                {p.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                {p.nickname && (
                  <p className="text-xs text-gray-500">{p.nickname}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDetailPayee(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={p.status} />
              {p.verifiedAt && (
                <span className="text-xs text-gray-400">
                  Verified {p.verifiedAt}
                </span>
              )}
            </div>

            {/* bank details */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 size={16} className="text-gray-400" />
                {p.bankName}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Account Number</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">
                      {showDetailAccount ? p.accountNumber : maskAccount(p.accountNumber)}
                    </span>
                    <button
                      onClick={() => setShowDetailAccount(!showDetailAccount)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showDetailAccount ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Routing Number</p>
                  <span className="font-mono font-medium">
                    {formatRouting(p.routingNumber)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Account Type</p>
                <span className="text-sm capitalize font-medium">{p.accountType}</span>
              </div>
            </div>

            {/* contact info */}
            {(p.email || p.phone || p.address) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </p>
                {p.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail size={14} className="text-gray-400" /> {p.email}
                  </div>
                )}
                {p.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone size={14} className="text-gray-400" /> {p.phone}
                  </div>
                )}
                {p.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={14} className="text-gray-400" /> {p.address}
                  </div>
                )}
              </div>
            )}

            {/* payment stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-700">{p.totalPayments}</p>
                <p className="text-xs text-indigo-600">Total Payments</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {p.lastPaymentDate ?? "—"}
                </p>
                <p className="text-xs text-gray-500">Last Payment</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={() => {
                setDetailPayee(null);
                openEdit(p);
              }}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg inline-flex items-center gap-1.5"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={() => setDetailPayee(null)}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── render ─────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payees</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage people and businesses you pay &middot;{" "}
            <span className="font-semibold text-gray-700">
              {counts.verified} verified
            </span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Payee
        </button>
      </div>

      {/* filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["all", "verified", "pending", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
              <span className="ml-1 text-gray-400">({counts[f]})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search payees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* payee list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-50">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
            onClick={() => {
              setShowDetailAccount(false);
              setDetailPayee(p);
            }}
          >
            {/* avatar */}
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
              {p.name.charAt(0)}
            </div>

            {/* info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
                {p.nickname && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {p.nickname}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Building2 size={11} /> {p.bankName}
                </span>
                <span className="font-mono">••{p.accountNumber.slice(-4)}</span>
                <span className="capitalize">{p.accountType}</span>
              </div>
            </div>

            {/* status + meta */}
            <div className="text-right shrink-0 space-y-1">
              <StatusBadge status={p.status} />
              {p.lastPaymentDate && (
                <p className="text-[10px] text-gray-400">
                  Last paid {timeAgo(p.lastPaymentDate)}
                </p>
              )}
            </div>

            {/* actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(p);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deletePayee(p.id);
                }}
                className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} className="text-gray-300 ml-1" />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-400">
            {search || filter !== "all"
              ? "No payees match your search."
              : 'No payees yet. Click "Add Payee" to get started.'}
          </div>
        )}
      </div>

      {/* ── Add/Edit Payee Modal ──────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <User size={16} className="text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  {editingId ? "Edit Payee" : "Add New Payee"}
                </h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Payee identity */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Payee Information
                </p>
                <Field label="Full Name / Business Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. ConEdison, John Smith"
                    className="input"
                  />
                </Field>
                <Field label="Nickname (optional)">
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={(e) => set("nickname", e.target.value)}
                    placeholder="e.g. Electric, Landlord"
                    className="input"
                  />
                </Field>
              </section>

              {/* Bank details */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Bank Account Details
                </p>
                <Field label="Routing Number (9 digits)" required>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={9}
                      value={form.routingNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        set("routingNumber", val);
                      }}
                      placeholder="e.g. 021000021"
                      className="input font-mono pr-8"
                    />
                    {form.routingNumber.length === 9 && resolvedBank && (
                      <CheckCircle2
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                      />
                    )}
                  </div>
                  {/* live bank resolution */}
                  {form.routingNumber.length === 9 && (
                    <div
                      className={`mt-1.5 flex items-center gap-2 text-xs ${
                        resolvedBank ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      <Building2 size={12} />
                      {resolvedBank
                        ? resolvedBank
                        : "Routing number not recognized. Please verify."}
                    </div>
                  )}
                </Field>

                <Field label="Account Number" required>
                  <div className="relative">
                    <input
                      type={showAccount ? "text" : "password"}
                      value={form.accountNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        set("accountNumber", val);
                      }}
                      placeholder="Enter account number"
                      className="input font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccount(!showAccount)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAccount ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm Account Number" required>
                  <input
                    type={showAccount ? "text" : "password"}
                    value={form.accountNumberConfirm}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      set("accountNumberConfirm", val);
                    }}
                    placeholder="Re-enter account number"
                    className="input font-mono"
                  />
                  {form.accountNumberConfirm &&
                    form.accountNumber !== form.accountNumberConfirm && (
                      <p className="text-xs text-red-600 mt-1">
                        Account numbers do not match.
                      </p>
                    )}
                </Field>

                <Field label="Account Type">
                  <div className="flex gap-3">
                    {(["checking", "savings"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => set("accountType", t)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                          form.accountType === t
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        <CreditCard
                          size={14}
                          className="inline mr-1.5 -mt-0.5"
                        />
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </section>

              {/* Optional contact */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Contact Information (optional)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="payee@email.com"
                      className="input"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Address">
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="123 Main St, City, State"
                    className="input"
                  />
                </Field>
              </section>

              {/* Verification progress */}
              <VerificationProgress />
            </div>

            {/* footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <ShieldCheck size={12} />
                Bank-grade encryption
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={savePayee}
                  disabled={
                    !form.name ||
                    form.routingNumber.length !== 9 ||
                    !form.accountNumber ||
                    form.accountNumber !== form.accountNumberConfirm ||
                    (verifStep !== "idle" && verifStep !== "done" && verifStep !== "failed")
                  }
                  className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {verifStep === "idle" || verifStep === "done" || verifStep === "failed" ? (
                    <>
                      <ShieldCheck size={14} />
                      {editingId ? "Save & Verify" : "Add & Verify Payee"}
                    </>
                  ) : (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Verifying...
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailPayee && <DetailPanel p={detailPayee} />}

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #6366f1;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
