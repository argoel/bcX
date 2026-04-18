import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "../state/store";
import { applySubaccount, rootClient } from "../services/root";
import type { Employer } from "../types";

/**
 * Simulated "Sign in with Google Workspace" gate.  Collects the admin's
 * email + company name, then provisions the employer + Root subaccount.
 */
export default function Login() {
  const { state, update } = useStore();
  const nav = useNavigate();

  const [email, setEmail] = useState("payroll@acme.com");
  const [company, setCompany] = useState("Acme Inc.");
  const [name, setName] = useState("Alex Admin");
  const [busy, setBusy] = useState(false);

  if (state.employer) return <Navigate to="/" replace />;

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !company || !name) return;
    setBusy(true);

    const id = `emp_${Date.now()}`;
    const employer: Employer = {
      id,
      companyName: company,
      gsuiteDomain: email.split("@")[1] ?? "example.com",
      admin: {
        email,
        name,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name,
        )}&background=4f46e5&color=fff&bold=true`,
      },
      rootSubaccountId: "",
      createdAt: new Date().toISOString(),
    };

    // Simulated OAuth handshake; then provision a Root subaccount.
    await new Promise((r) => setTimeout(r, 900));
    try {
      const result = await rootClient.createSubaccount({ employer });
      update((draft) => {
        applySubaccount(draft.root, result);
        draft.employer = { ...employer, rootSubaccountId: result.resource.id };
      });
      nav("/", { replace: true });
    } catch (err) {
      alert(`Could not create Root subaccount: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            myPay
          </h1>
          <p className="text-indigo-200 text-sm">
            Run payroll in one click · powered by Root
          </p>
        </div>

        <form
          onSubmit={signIn}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                Sign in with Google Workspace
              </p>
              <p className="text-xs text-gray-500 mt-1">
                myPay admin portal — demo mode
              </p>
            </div>

            <div className="space-y-3">
              <Field label="Work email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input"
                />
              </Field>
              <Field label="Your name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Company name">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin text-gray-500" />
              ) : (
                <GoogleLogo />
              )}
              <span className="text-sm font-medium text-gray-700">
                {busy ? "Creating your account…" : "Continue with Google"}
              </span>
            </button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              By continuing you authorize myPay to provision a subaccount on
              the Root sandbox and act as payroll agent for your company.
            </p>
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-[10px] text-gray-500 flex items-center justify-center gap-1">
            <ShieldCheck size={10} /> Demo · connects to Root sandbox only
          </div>
        </form>
      </div>

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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
