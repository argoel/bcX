import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  Clock,
  CreditCard,
} from "lucide-react";
import { mockAccounts, mockTransactions, mockBills } from "../data/mock";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));
}

export default function Dashboard() {
  const totalBalance = mockAccounts.reduce((s, a) => s + a.balance, 0);
  const recentTx = [...mockTransactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const upcomingBills = [...mockBills]
    .filter((b) => b.status === "active")
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 5);
  const monthlyBillTotal = mockBills
    .filter((b) => b.status === "active")
    .reduce((s, b) => s + b.amount, 0);

  const accountName = (id: string) =>
    mockAccounts.find((a) => a.id === id)?.bankName ?? "Unknown";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Wallet size={20} />}
          label="Net Balance"
          value={formatCurrency(totalBalance)}
          accent="text-indigo-600 bg-indigo-50"
        />
        <SummaryCard
          icon={<CreditCard size={20} />}
          label="Accounts Connected"
          value={String(mockAccounts.length)}
          accent="text-emerald-600 bg-emerald-50"
        />
        <SummaryCard
          icon={<TrendingDown size={20} />}
          label="Monthly Bills"
          value={formatCurrency(monthlyBillTotal)}
          accent="text-orange-600 bg-orange-50"
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          label="Pending Transactions"
          value={String(
            mockTransactions.filter((t) => t.status === "pending").length
          )}
          accent="text-sky-600 bg-sky-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">
              Recent Transactions
            </h3>
            <Link
              to="/transactions"
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {recentTx.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.merchant}</p>
                  <p className="text-xs text-gray-500">
                    {tx.date} &middot; {accountName(tx.accountId)}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    tx.amount >= 0 ? "text-emerald-600" : "text-gray-900"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Upcoming bills */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Upcoming Bills</h3>
            <Link
              to="/bills"
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {upcomingBills.map((bill) => (
              <li
                key={bill.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{bill.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    Due {bill.nextDueDate} &middot;{" "}
                    {bill.autoPay ? "Auto-pay" : "Manual"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {formatCurrency(bill.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Account balances */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Account Balances</h3>
          <Link
            to="/accounts"
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Manage accounts <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {mockAccounts.map((acc) => (
            <div key={acc.id} className="px-5 py-4">
              <p className="text-sm text-gray-500">
                {acc.bankLogo} {acc.bankName}
              </p>
              <p className="text-xs text-gray-400 mb-1">
                {acc.accountType.charAt(0).toUpperCase() +
                  acc.accountType.slice(1)}{" "}
                {acc.accountNumber}
              </p>
              <p
                className={`text-lg font-bold ${
                  acc.balance >= 0 ? "text-gray-900" : "text-red-600"
                }`}
              >
                {acc.balance < 0 && "-"}
                {formatCurrency(acc.balance)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`rounded-lg p-2.5 ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
