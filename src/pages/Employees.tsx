import { useState } from "react";
import {
  Plus,
  Users,
  Link2,
  Link2Off,
  X,
  Mail,
  Briefcase,
  DollarSign,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useActiveTenant, useStore, withActiveTenant } from "../state/store";
import { fmtUsd } from "../lib/money";
import { grossPerPeriodCents } from "../lib/payroll";
import {
  applyBankToken,
  applyPayee,
  pushActivity,
  rootClient,
  upsertPayees,
} from "../services/root";
import RootLinkModal from "../components/RootLinkModal";
import type { Employee, PayFrequency } from "../types";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "",
  annualSalary: 60000,
  payFrequency: "weekly" as PayFrequency,
};

export default function Employees() {
  const { state, update } = useStore();
  const tenant = useActiveTenant();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [linkFor, setLinkFor] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!tenant) return null;
  const employees = tenant.employees;
  const subaccountId = tenant.employer.rootSubaccountId;

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) return;
    setCreating(true);
    try {
      // 1. Create the payee on Root (source of truth).
      const payeeRes = await rootClient.createPayee({
        subaccountId,
        name: `${form.firstName} ${form.lastName}`,
        email: form.email,
      });
      // 2. Persist the local HCM record referencing the Root payee.
      update((draft) => {
        applyPayee(draft.root, payeeRes);
        withActiveTenant(draft, (t) => {
          t.employees.push({
            id: `emp_${Date.now().toString(36)}`,
            rootPayeeId: payeeRes.resource.id,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            jobTitle: form.jobTitle || "Team Member",
            annualSalary: form.annualSalary,
            payFrequency: form.payFrequency,
            createdAt: new Date().toISOString(),
          });
        });
      });
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      alert(`Could not create payee on Root: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  function removeEmployee(id: string) {
    if (!confirm("Remove this employee from myPay?")) return;
    update((draft) => {
      withActiveTenant(draft, (t) => {
        t.employees = t.employees.filter((e) => e.id !== id);
      });
    });
  }

  async function syncFromRoot() {
    setSyncing(true);
    try {
      const list = await rootClient.listPayees({ subaccountId });
      update((draft) => {
        upsertPayees(draft.root, list.payees);
        pushActivity(draft.root, list.activity);
        withActiveTenant(draft, (t) => {
          for (const p of list.payees) {
            const hit = t.employees.find(
              (e) => e.rootPayeeId === p.id || e.email === p.email,
            );
            if (hit) {
              hit.rootPayeeId = p.id;
              if (p.bankTokenId && !hit.rootBankToken) {
                hit.rootBankToken = p.bankTokenId;
                const bt = draft.root.bankTokens[p.bankTokenId];
                if (bt) hit.bankDisplay = `${bt.bankName} ••${bt.last4}`;
              }
              continue;
            }
            const [firstName, ...rest] = p.name.split(" ");
            const newEmp: Employee = {
              id: `emp_${Math.random().toString(36).slice(2, 10)}`,
              rootPayeeId: p.id,
              firstName: firstName ?? p.name,
              lastName: rest.join(" "),
              email: p.email,
              jobTitle: "Imported from Root",
              annualSalary: 0,
              payFrequency: "weekly",
              createdAt: p.createdAt,
            };
            if (p.bankTokenId) {
              newEmp.rootBankToken = p.bankTokenId;
              const bt = draft.root.bankTokens[p.bankTokenId];
              if (bt) newEmp.bankDisplay = `${bt.bankName} ••${bt.last4}`;
            }
            t.employees.push(newEmp);
          }
        });
      });
    } catch (err) {
      alert(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function onBankLinked(
    employee: Employee,
    result: {
      bankName: string;
      accountType: "checking" | "savings";
      last4: string;
    },
  ) {
    try {
      const payee = employee.rootPayeeId
        ? state.root.payees[employee.rootPayeeId]
        : undefined;
      const out = await rootClient.linkBankAccount(
        {
          ownerType: "employee",
          ownerId: employee.rootPayeeId ?? employee.id,
          bankName: result.bankName,
          accountType: result.accountType,
          last4: result.last4,
          achDebitAuthorized: false,
        },
        payee ? { payee } : undefined,
      );
      update((draft) => {
        applyBankToken(draft.root, out);
        if (out.payee) draft.root.payees[out.payee.id] = out.payee;
        withActiveTenant(draft, (t) => {
          const target = t.employees.find((e) => e.id === employee.id);
          if (target) {
            target.rootBankToken = out.resource.id;
            target.bankDisplay = `${result.bankName} ••${result.last4}`;
          }
        });
      });
    } catch (err) {
      alert(`Link failed: ${(err as Error).message}`);
    }
    setLinkFor(null);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employees</h2>
          <p className="text-sm text-gray-500 mt-1">
            myPay HCM · add teammates and link each one's payout account through
            Root
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncFromRoot}
            disabled={syncing}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-2.5 rounded-lg disabled:opacity-50"
            title="Pull the latest payees from Root"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Sync from Root
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center space-y-3">
          <Users size={32} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">
            No employees yet.  Add someone or pull your existing payees from
            Root.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={syncFromRoot}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Sync from Root
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Title</th>
                <th className="text-left px-5 py-3 font-medium">Pay</th>
                <th className="text-left px-5 py-3 font-medium">Per period</th>
                <th className="text-left px-5 py-3 font-medium">
                  Payout account
                </th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {e.firstName} {e.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{e.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{e.jobTitle}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {fmtUsd(e.annualSalary * 100)}
                      <span className="text-xs text-gray-400 font-normal">
                        {" "}
                        / yr
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {e.payFrequency}
                    </p>
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {fmtUsd(grossPerPeriodCents(e))}
                  </td>
                  <td className="px-5 py-3">
                    {e.bankDisplay ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> {e.bankDisplay}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Link2Off size={12} /> Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!e.bankDisplay && (
                        <button
                          onClick={() => setLinkFor(e)}
                          className="text-xs font-medium inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-md px-2 py-1"
                        >
                          <Link2 size={12} /> Link bank
                        </button>
                      )}
                      <button
                        onClick={() => removeEmployee(e.id)}
                        className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add-employee modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={addEmployee}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">Add Employee</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, firstName: ev.target.value }))
                    }
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, lastName: ev.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Work email">
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    className="input pl-8"
                    value={form.email}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, email: ev.target.value }))
                    }
                  />
                </div>
              </Field>
              <Field label="Job title">
                <div className="relative">
                  <Briefcase
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    className="input pl-8"
                    value={form.jobTitle}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, jobTitle: ev.target.value }))
                    }
                    placeholder="e.g. Software Engineer"
                  />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Annual salary (USD)">
                  <div className="relative">
                    <DollarSign
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      className="input pl-8"
                      value={form.annualSalary}
                      onChange={(ev) =>
                        setForm((f) => ({
                          ...f,
                          annualSalary: parseInt(ev.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </Field>
                <Field label="Pay frequency">
                  <select
                    className="input"
                    value={form.payFrequency}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        payFrequency: ev.target.value as PayFrequency,
                      }))
                    }
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="semimonthly">Semimonthly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                disabled={
                  creating ||
                  !form.firstName ||
                  !form.lastName ||
                  !form.email
                }
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                {creating ? "Creating payee…" : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      <RootLinkModal
        mode="employee"
        open={!!linkFor}
        onClose={() => setLinkFor(null)}
        title={
          linkFor
            ? `Link payout account for ${linkFor.firstName} ${linkFor.lastName}`
            : undefined
        }
        onLinked={(result) => linkFor && onBankLinked(linkFor, result)}
      />

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
