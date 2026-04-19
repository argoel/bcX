import { Link } from "react-router-dom";
import {
  Users,
  Banknote,
  Wallet,
  CalendarCheck,
  ArrowRight,
  CheckCircle2,
  Circle,
  Activity,
  TrendingUp,
} from "lucide-react";
import { useActiveTenant, useStore } from "../state/store";
import { fmtUsd, nextFriday } from "../lib/money";
import { grossPerPeriodCents } from "../lib/payroll";

export default function Dashboard() {
  const { state } = useStore();
  const tenant = useActiveTenant();
  if (!tenant) return null;
  const { employer, employees, payrollRuns } = tenant;

  const sub = state.root.subaccounts[employer.rootSubaccountId];
  const employerBank = Object.values(state.root.bankTokens).find(
    (b) => b.ownerType === "employer" && b.achDebitAuthorized,
  );
  const employeesWithBank = employees.filter((e) => e.rootBankToken);
  const lastRun = payrollRuns[0];

  const nextPayrollGross = employees
    .filter((e) => e.rootBankToken)
    .reduce((sum, e) => sum + grossPerPeriodCents(e), 0);

  // Progress checklist
  const steps = [
    { id: "signin", label: "Sign in with Google Workspace", done: true },
    {
      id: "employees",
      label: "Add employees to the HCM",
      done: employees.length > 0,
      to: "/employees",
    },
    {
      id: "emp-bank",
      label: "Link bank accounts for each employee",
      done: employees.length > 0 && employeesWithBank.length === employees.length,
      to: "/employees",
    },
    {
      id: "co-bank",
      label: "Link your company bank (with ACH debit authorization)",
      done: !!employerBank,
      to: "/company-bank",
    },
    {
      id: "fund",
      label: "Prefund the Root subaccount",
      done: !!sub && sub.balanceCents > 0,
      to: "/funding",
    },
    {
      id: "run",
      label: "Run this week's payroll",
      done: (lastRun?.status === "complete" || lastRun?.status === "partial"),
      to: "/payroll",
    },
  ];

  const currentAdmin =
    tenant.admins.find((a) => a.email === state.session.adminEmail) ??
    tenant.admins[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Welcome back, {currentAdmin?.name.split(" ")[0] ?? "admin"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Payroll for{" "}
          <span className="font-medium text-gray-700">
            {employer.companyName}
          </span>{" "}
          — pay period ending {nextFriday()}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={<Wallet size={18} />}
          tint="text-indigo-600 bg-indigo-50"
          label="Subaccount balance"
          value={sub ? fmtUsd(sub.balanceCents) : "—"}
          sub={
            sub && sub.pendingInCents > 0
              ? `${fmtUsd(sub.pendingInCents)} pending in`
              : sub && sub.pendingOutCents > 0
                ? `${fmtUsd(sub.pendingOutCents)} pending out`
                : "on Root sandbox"
          }
        />
        <Kpi
          icon={<Users size={18} />}
          tint="text-emerald-600 bg-emerald-50"
          label="Employees"
          value={String(employees.length)}
          sub={`${employeesWithBank.length} bank-linked`}
        />
        <Kpi
          icon={<Banknote size={18} />}
          tint="text-sky-600 bg-sky-50"
          label="Company bank"
          value={
            employerBank
              ? `${employerBank.bankName} ••${employerBank.last4}`
              : "Not linked"
          }
          sub={employerBank ? "ACH debit authorized" : "Link to begin"}
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          tint="text-purple-600 bg-purple-50"
          label="Next pay-period gross"
          value={fmtUsd(nextPayrollGross)}
          sub={`${employeesWithBank.length} paychecks`}
        />
      </div>

      {/* Getting started checklist */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Getting started</h3>
          <Link
            to="/root-activity"
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <Activity size={12} /> Root activity
          </Link>
        </div>
        <ul className="divide-y divide-gray-50">
          {steps.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 px-5 py-3 text-sm"
            >
              {s.done ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : (
                <Circle size={18} className="text-gray-300 shrink-0" />
              )}
              <span
                className={
                  s.done
                    ? "text-gray-400 line-through"
                    : "text-gray-800 font-medium"
                }
              >
                {s.label}
              </span>
              {!s.done && s.to && (
                <Link
                  to={s.to}
                  className="ml-auto text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                >
                  Go <ArrowRight size={12} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          to="/employees"
          icon={<Users size={18} />}
          title="Add or manage employees"
          desc="Update salaries, link payout accounts"
        />
        <QuickAction
          to="/funding"
          icon={<Wallet size={18} />}
          title="Prefund subaccount"
          desc="ACH debit pull from your bank"
        />
        <QuickAction
          to="/payroll"
          icon={<CalendarCheck size={18} />}
          title="Run this week's payroll"
          desc="Disburse paychecks in one click"
        />
      </div>
    </div>
  );
}

function Kpi({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tint}`}>{icon}</div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold mt-3">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-start gap-3 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="rounded-lg p-2 bg-indigo-50 text-indigo-600">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ArrowRight size={14} className="text-gray-300" />
    </Link>
  );
}
