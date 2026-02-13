import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  User,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { mockBills, mockAccounts, mockPayees } from "../data/mock";
import type { Bill, Payee } from "../types";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const emptyBill: Omit<Bill, "id"> = {
  name: "",
  payee: "",
  payeeId: "",
  amount: 0,
  frequency: "monthly",
  nextDueDate: "",
  autoPay: false,
  payFromAccountId: mockAccounts[0]?.id ?? "",
  category: "Utilities",
  status: "active",
};

const categoryOptions = [
  "Housing",
  "Utilities",
  "Entertainment",
  "Health",
  "Insurance",
  "Transportation",
  "Education",
  "Other",
];

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>(mockBills);
  const [payees] = useState<Payee[]>(mockPayees);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBill);
  const [payeeSearch, setPayeeSearch] = useState("");
  const [showPayeeDropdown, setShowPayeeDropdown] = useState(false);

  const verifiedPayees = payees.filter((p) => p.status === "verified");

  function openAdd() {
    setEditingId(null);
    setForm(emptyBill);
    setPayeeSearch("");
    setShowPayeeDropdown(false);
    setShowForm(true);
  }

  function openEdit(bill: Bill) {
    setEditingId(bill.id);
    const { id: _id, ...rest } = bill;
    void _id;
    setForm(rest);
    setPayeeSearch("");
    setShowPayeeDropdown(false);
    setShowForm(true);
  }

  function selectPayee(p: Payee) {
    setForm((f) => ({ ...f, payee: p.name, payeeId: p.id }));
    setPayeeSearch("");
    setShowPayeeDropdown(false);
  }

  function clearPayee() {
    setForm((f) => ({ ...f, payee: "", payeeId: "" }));
  }

  function saveBill() {
    if (!form.name || !form.payeeId || !form.amount || !form.nextDueDate) return;
    if (editingId) {
      setBills((prev) =>
        prev.map((b) => (b.id === editingId ? { ...form, id: editingId } : b))
      );
    } else {
      setBills((prev) => [
        ...prev,
        { ...form, id: `bill-${Date.now()}` },
      ]);
    }
    setShowForm(false);
  }

  function deleteBill(id: string) {
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  function toggleAutoPay(id: string) {
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, autoPay: !b.autoPay } : b))
    );
  }

  function changePayAccount(id: string, accountId: string) {
    setBills((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, payFromAccountId: accountId } : b
      )
    );
  }

  const accountName = (id: string) => {
    const acc = mockAccounts.find((a) => a.id === id);
    return acc ? `${acc.bankName} ${acc.accountNumber}` : "Unknown";
  };

  const payeeName = (bill: Bill) => {
    if (bill.payeeId) {
      const p = payees.find((pp) => pp.id === bill.payeeId);
      return p ? p.name : bill.payee;
    }
    return bill.payee;
  };

  const payeeBank = (bill: Bill) => {
    if (bill.payeeId) {
      const p = payees.find((pp) => pp.id === bill.payeeId);
      return p ? `${p.bankName} ••${p.accountNumber.slice(-4)}` : null;
    }
    return null;
  };

  const selectedPayee = form.payeeId
    ? payees.find((p) => p.id === form.payeeId)
    : null;

  const filteredPayees = payeeSearch
    ? verifiedPayees.filter(
        (p) =>
          p.name.toLowerCase().includes(payeeSearch.toLowerCase()) ||
          (p.nickname?.toLowerCase().includes(payeeSearch.toLowerCase()) ?? false)
      )
    : verifiedPayees;

  const totalMonthly = bills
    .filter((b) => b.status === "active")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bills</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage recurring bills and auto-pay &middot; Total monthly:{" "}
            <span className="font-semibold text-gray-700">
              {formatCurrency(totalMonthly)}
            </span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Bill
        </button>
      </div>

      {/* Bills table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Bill
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Amount
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Frequency
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Next Due
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Pay From
              </th>
              <th className="text-center px-5 py-3 font-medium text-gray-500">
                Auto-Pay
              </th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium">{bill.name}</p>
                    <p className="text-xs text-gray-400">
                      {payeeName(bill)}
                      {payeeBank(bill) && (
                        <span className="ml-1.5 text-gray-300">
                          &middot; {payeeBank(bill)}
                        </span>
                      )}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-3 font-semibold">
                  {formatCurrency(bill.amount)}
                </td>
                <td className="px-5 py-3">
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full capitalize">
                    {bill.frequency}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">{bill.nextDueDate}</td>
                <td className="px-5 py-3">
                  <select
                    value={bill.payFromAccountId}
                    onChange={(e) =>
                      changePayAccount(bill.id, e.target.value)
                    }
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {mockAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} {a.accountNumber}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => toggleAutoPay(bill.id)}
                    className="inline-flex items-center justify-center"
                    title={bill.autoPay ? "Disable auto-pay" : "Enable auto-pay"}
                  >
                    {bill.autoPay ? (
                      <ToggleRight
                        size={28}
                        className="text-indigo-600"
                      />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-300" />
                    )}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(bill)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  No bills yet. Click &ldquo;Add Bill&rdquo; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-gray-900">
                {editingId ? "Edit Bill" : "Add New Bill"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <Field label="Bill Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Electric Bill"
                  className="input"
                />
              </Field>

              {/* ── Payee selector ── */}
              <Field label="Payee">
                {selectedPayee ? (
                  <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                          {selectedPayee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedPayee.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedPayee.bankName} &middot; ••
                            {selectedPayee.accountNumber.slice(-4)} &middot;{" "}
                            <span className="capitalize">
                              {selectedPayee.accountType}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={14}
                          className="text-emerald-500"
                        />
                        <button
                          onClick={clearPayee}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={payeeSearch}
                      onChange={(e) => {
                        setPayeeSearch(e.target.value);
                        setShowPayeeDropdown(true);
                      }}
                      onFocus={() => setShowPayeeDropdown(true)}
                      placeholder="Search verified payees..."
                      className="input"
                    />
                    {showPayeeDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {filteredPayees.length > 0 ? (
                          filteredPayees.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => selectPayee(p)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                            >
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px] shrink-0">
                                {p.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {p.name}
                                  {p.nickname && (
                                    <span className="text-gray-400 font-normal ml-1">
                                      ({p.nickname})
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {p.bankName} &middot; ••
                                  {p.accountNumber.slice(-4)}
                                </p>
                              </div>
                              <CheckCircle2
                                size={12}
                                className="text-emerald-400 shrink-0"
                              />
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center space-y-2">
                            <User
                              size={20}
                              className="mx-auto text-gray-300"
                            />
                            <p className="text-xs text-gray-400">
                              No matching payees found.
                            </p>
                            <Link
                              to="/payees"
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              <Plus size={12} /> Add a new payee
                              <ExternalLink size={10} />
                            </Link>
                          </div>
                        )}
                        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
                          <Link
                            to="/payees"
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            <User size={12} /> Manage all payees
                            <ExternalLink size={10} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount ($)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.amount || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="input"
                  />
                </Field>
                <Field label="Frequency">
                  <select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        frequency: e.target.value as Bill["frequency"],
                      }))
                    }
                    className="input"
                  >
                    <option value="once">Once</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Next Due Date">
                  <input
                    type="date"
                    value={form.nextDueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nextDueDate: e.target.value }))
                    }
                    className="input"
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="input"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Pay From Account">
                <select
                  value={form.payFromAccountId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      payFromAccountId: e.target.value,
                    }))
                  }
                  className="input"
                >
                  {mockAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} {a.accountNumber}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoPay}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, autoPay: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Enable auto-pay
                </span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveBill}
                disabled={!form.name || !form.payeeId || !form.amount || !form.nextDueDate}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "Save Changes" : "Add Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
