import { useState } from "react";
import {
  Banknote,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../state/store";
import RootLinkModal from "../components/RootLinkModal";
import { linkBankAccount } from "../services/root";

export default function CompanyBank() {
  const { state, update } = useStore();
  const [open, setOpen] = useState(false);
  const employer = state.employer;
  if (!employer) return null;

  const banks = Object.values(state.root.bankTokens).filter(
    (b) => b.ownerType === "employer" && b.ownerId === employer.id,
  );

  function unlink(id: string) {
    if (!confirm("Unlink this company bank account?")) return;
    update((draft) => {
      delete draft.root.bankTokens[id];
      draft.root.activity.unshift({
        id: `act_${Math.random().toString(36).slice(2, 10)}`,
        at: new Date().toISOString(),
        endpoint: "DELETE /v1/bank-accounts/:id",
        summary: `Unlinked employer bank ${id}`,
        status: "ok",
      });
    });
  }

  function onLinked(result: {
    bankName: string;
    accountType: "checking" | "savings";
    last4: string;
    achDebitAuthorized: boolean;
  }) {
    update((draft) => {
      linkBankAccount(draft.root, {
        ownerType: "employer",
        ownerId: employer.id,
        bankName: result.bankName,
        accountType: result.accountType,
        last4: result.last4,
        achDebitAuthorized: result.achDebitAuthorized,
      });
    });
    setOpen(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Bank</h2>
          <p className="text-sm text-gray-500 mt-1">
            Link your corporate operating account with an ACH debit
            authorization — myPay uses this to prefund the Root subaccount
            before each payroll run.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={16} /> Link Bank
        </button>
      </div>

      {banks.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center space-y-3">
          <Banknote size={32} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">
            No company bank linked yet. Link one to authorize ACH debit pulls
            via Root.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={14} /> Link your first bank
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banks.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Banknote size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{b.bankName}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {b.accountType} ••{b.last4}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => unlink(b.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Unlink"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                {b.achDebitAuthorized ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> ACH debit authorized
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={12} /> Not authorized for debit
                  </span>
                )}
                <span className="text-gray-400 font-mono">{b.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Why we need this */}
      <section className="bg-indigo-50 rounded-xl border border-indigo-100 p-5 text-sm text-indigo-900 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={16} /> Why myPay needs this
        </div>
        <p className="text-xs leading-relaxed">
          Every payroll cycle, myPay draws the total net-paycheck amount from
          your linked operating account into a dedicated{" "}
          <span className="font-semibold">Root subaccount</span>. Funds are held
          there only long enough to disburse to employees. We never hold payroll
          funds on our own balance sheet.
        </p>
      </section>

      <RootLinkModal
        mode="employer"
        open={open}
        onClose={() => setOpen(false)}
        onLinked={onLinked}
        title="Link company bank & authorize ACH debits"
      />
    </div>
  );
}
