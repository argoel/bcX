import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import { mockTransactions, mockAccounts } from "../data/mock";
import type { Transaction } from "../types";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));
}

type SortField = "date" | "amount" | "merchant" | "category";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "category" | "account" | "date";

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const categories = useMemo(
    () => [...new Set(mockTransactions.map((t) => t.category))].sort(),
    []
  );

  const accountName = (id: string) =>
    mockAccounts.find((a) => a.id === id)?.bankName ?? "Unknown";

  // Filter
  const filtered = useMemo(() => {
    return mockTransactions.filter((tx) => {
      if (
        search &&
        !tx.merchant.toLowerCase().includes(search.toLowerCase()) &&
        !tx.description.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (categoryFilter !== "all" && tx.category !== categoryFilter)
        return false;
      if (accountFilter !== "all" && tx.accountId !== accountFilter)
        return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      return true;
    });
  }, [search, categoryFilter, accountFilter, statusFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "merchant":
          cmp = a.merchant.localeCompare(b.merchant);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Group
  const grouped = useMemo(() => {
    if (groupBy === "none") return { All: sorted };
    const map: Record<string, Transaction[]> = {};
    for (const tx of sorted) {
      let key: string;
      switch (groupBy) {
        case "category":
          key = tx.category;
          break;
        case "account":
          key = accountName(tx.accountId);
          break;
        case "date":
          key = tx.date;
          break;
      }
      (map[key] ??= []).push(tx);
    }
    return map;
  }, [sorted, groupBy]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="text-indigo-600" />
    ) : (
      <ChevronDown size={12} className="text-indigo-600" />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Transactions</h2>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search merchant or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Account filter */}
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Accounts</option>
          {mockAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bankName} {a.accountNumber}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
        </select>

        {/* Group by */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="none">No Grouping</option>
          <option value="category">Group by Category</option>
          <option value="account">Group by Account</option>
          <option value="date">Group by Date</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        {filtered.length} transaction{filtered.length !== 1 && "s"} found
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {Object.entries(grouped).map(([group, txs]) => (
          <div key={group}>
            {groupBy !== "none" && (
              <div className="bg-gray-50 px-5 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  ({txs.length})
                </span>
              </div>
            )}
            <table className="w-full text-sm">
              {group === Object.keys(grouped)[0] && (
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th
                      className="text-left px-5 py-3 font-medium text-gray-500 cursor-pointer select-none"
                      onClick={() => toggleSort("date")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Date <SortIcon field="date" />
                      </span>
                    </th>
                    <th
                      className="text-left px-5 py-3 font-medium text-gray-500 cursor-pointer select-none"
                      onClick={() => toggleSort("merchant")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Merchant <SortIcon field="merchant" />
                      </span>
                    </th>
                    <th
                      className="text-left px-5 py-3 font-medium text-gray-500 cursor-pointer select-none"
                      onClick={() => toggleSort("category")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Category <SortIcon field="category" />
                      </span>
                    </th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">
                      Account
                    </th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">
                      Status
                    </th>
                    <th
                      className="text-right px-5 py-3 font-medium text-gray-500 cursor-pointer select-none"
                      onClick={() => toggleSort("amount")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Amount <SortIcon field="amount" />
                      </span>
                    </th>
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-gray-50">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="px-5 py-3 font-medium">{tx.merchant}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {accountName(tx.accountId)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          tx.status === "posted"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${
                        tx.amount >= 0 ? "text-emerald-600" : "text-gray-900"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
