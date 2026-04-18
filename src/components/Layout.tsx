import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Banknote,
  Wallet,
  CalendarCheck,
  Activity,
  LogOut,
} from "lucide-react";
import { useStore } from "../state/store";
import { fmtUsd } from "../lib/money";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employees", icon: Users, label: "Employees" },
  { to: "/company-bank", icon: Banknote, label: "Company Bank" },
  { to: "/funding", icon: Wallet, label: "Funding" },
  { to: "/payroll", icon: CalendarCheck, label: "Payroll" },
  { to: "/root-activity", icon: Activity, label: "Root Activity" },
];

export default function Layout() {
  const { state, reset } = useStore();
  const nav = useNavigate();
  const employer = state.employer;
  const sub = employer
    ? state.root.subaccounts[employer.rootSubaccountId]
    : undefined;

  function signOut() {
    if (!confirm("Sign out and clear all local myPay + Root sandbox data?"))
      return;
    reset();
    nav("/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white tracking-tight">
            myPay
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Payroll, powered by Root
          </p>
        </div>

        {employer && (
          <div className="px-5 py-4 border-b border-gray-800 space-y-2">
            <div className="flex items-center gap-2">
              <img
                src={employer.admin.picture}
                alt=""
                className="w-8 h-8 rounded-full"
              />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {employer.admin.name}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {employer.companyName}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-gray-800/60 px-2.5 py-2 text-[11px]">
              <p className="text-gray-400 uppercase tracking-wider mb-0.5">
                Root subaccount
              </p>
              <p className="text-white font-semibold text-sm">
                {sub ? fmtUsd(sub.balanceCents) : "—"}
              </p>
              {sub && sub.pendingInCents > 0 && (
                <p className="text-amber-400 text-[10px] mt-0.5">
                  {fmtUsd(sub.pendingInCents)} pending in
                </p>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-900/30 rounded px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Root Sandbox
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
