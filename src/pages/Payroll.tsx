import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  Wallet,
} from "lucide-react";
import { useStore } from "../state/store";
import { fmtUsd, nextFriday } from "../lib/money";
import { buildLineItem } from "../lib/payroll";
import { applyTransfer, pushActivity, rootClient } from "../services/root";
import type { PayrollLineItem, PayrollRun } from "../types";

export default function Payroll() {
  const { state, update } = useStore();
  const employer = state.employer;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!employer) return null;
  const sub = state.root.subaccounts[employer.rootSubaccountId];

  // Build / reuse the current pay period's run.
  const periodEnd = nextFriday();
  const existingRun = state.payrollRuns.find((r) => r.periodEnd === periodEnd);
  const currentRun: PayrollRun | null = useMemo(() => {
    if (existingRun) return existingRun;
    if (state.employees.length === 0) return null;

    const lineItems = state.employees.map(buildLineItem);
    const totalGrossCents = lineItems.reduce((s, l) => s + l.grossCents, 0);
    const totalNetCents = lineItems.reduce((s, l) => s + l.netCents, 0);

    return {
      id: `run_${Date.now().toString(36)}`,
      employerId: employer.id,
      periodEnd,
      status: "draft",
      lineItems,
      totalGrossCents,
      totalNetCents,
      createdAt: new Date().toISOString(),
    };
  }, [existingRun, state.employees, employer.id, periodEnd]);

  const payable = currentRun?.lineItems.filter((l) => l.status === "draft") ?? [];
  const totalDueCents = payable.reduce((s, l) => s + l.netCents, 0);
  const canAfford = sub ? sub.balanceCents >= totalDueCents : false;

  async function runPayroll() {
    if (!currentRun || payable.length === 0) return;
    setError(null);

    if (!sub || sub.balanceCents < totalDueCents) {
      setError(
        `Insufficient subaccount balance. Need ${fmtUsd(totalDueCents)} net, have ${
          sub ? fmtUsd(sub.balanceCents) : "$0.00"
        }.`,
      );
      return;
    }

    // 1. Partition line items up-front into "to process" vs "skipped".
    type Task = { employeeId: string; netCents: number; bankTokenId: string };
    const tasks: Task[] = [];
    const skipIds = new Set<string>();
    for (const li of currentRun.lineItems) {
      if (li.status !== "draft") continue;
      const emp = state.employees.find((e) => e.id === li.employeeId);
      if (!emp || !emp.rootBankToken) {
        skipIds.add(li.employeeId);
      } else {
        tasks.push({
          employeeId: emp.id,
          netCents: li.netCents,
          bankTokenId: emp.rootBankToken,
        });
      }
    }

    setBusy(true);

    // 2. Persist a running skeleton of the run.  Clone line items so we
    //    don't mutate the existing store reference.
    const runId = currentRun.id;
    update((draft) => {
      const existingIdx = draft.payrollRuns.findIndex((r) => r.id === runId);
      const stored: PayrollRun = {
        ...currentRun,
        status: "running",
        lineItems: currentRun.lineItems.map((li) => ({
          ...li,
          status: skipIds.has(li.employeeId) ? "skipped" : li.status,
        })),
      };
      if (existingIdx >= 0) draft.payrollRuns[existingIdx] = stored;
      else draft.payrollRuns.unshift(stored);
    });

    // 3. Disburse each task sequentially.  Track the subaccount locally so
    //    the next call's balance check sees the previous debit.
    // Re-capture narrowed employer fields so TS keeps narrowing through awaits.
    const { rootSubaccountId, companyName } = employer!;
    let runningSub = { ...sub };
    for (const task of tasks) {
      const emp = state.employees.find((e) => e.id === task.employeeId);
      const bank = state.root.bankTokens[task.bankTokenId];
      if (!emp || !bank) continue;

      try {
        const out = await rootClient.initiateDisbursement(
          {
            subaccountId: rootSubaccountId,
            employeeBankTokenId: bank.id,
            amountCents: task.netCents,
            employeeId: emp.id,
            payrollRunId: runId,
            memo: `${companyName} payroll ${periodEnd}`,
            rail: "ach",
          },
          { subaccount: runningSub, bank },
        );
        if (out.subaccount) runningSub = out.subaccount;

        update((draft) => {
          applyTransfer(draft.root, out);
          const run = draft.payrollRuns.find((r) => r.id === runId);
          const target = run?.lineItems.find(
            (l) => l.employeeId === emp.id,
          );
          if (target) {
            target.transferId = out.resource.id;
            target.status = "disbursing";
          }
        });
      } catch (err) {
        const msg = (err as Error).message;
        update((draft) => {
          const run = draft.payrollRuns.find((r) => r.id === runId);
          const target = run?.lineItems.find(
            (l) => l.employeeId === emp.id,
          );
          if (target) target.status = "failed";
          pushActivity(draft.root, {
            id: `act_${Math.random().toString(36).slice(2, 10)}`,
            at: new Date().toISOString(),
            endpoint: "POST /v1/transfers (disbursement)",
            summary: `Disbursement to ${emp.firstName} ${emp.lastName} failed: ${msg}`,
            status: "error",
          });
        });
      }
    }

    setBusy(false);
  }

  const recentRuns = state.payrollRuns.slice(0, 5);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payroll</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pay period ending{" "}
            <span className="font-medium text-gray-700">{periodEnd}</span> ·{" "}
            {state.employees.length} employee
            {state.employees.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={runPayroll}
          disabled={
            busy ||
            !currentRun ||
            payable.length === 0 ||
            !canAfford ||
            currentRun.status !== "draft"
          }
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          title={
            !canAfford ? "Prefund the subaccount first" : "Disburse all paychecks"
          }
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          Run Payroll
        </button>
      </div>

      {/* Balance + summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Summary
          label="Subaccount balance"
          value={sub ? fmtUsd(sub.balanceCents) : "—"}
          icon={<Wallet size={16} />}
          tint="text-emerald-600 bg-emerald-50"
        />
        <Summary
          label="Net to disburse"
          value={fmtUsd(totalDueCents)}
          icon={<CalendarCheck size={16} />}
          tint="text-indigo-600 bg-indigo-50"
        />
        <Summary
          label="Employees on this run"
          value={String(payable.length)}
          icon={<CheckCircle2 size={16} />}
          tint="text-sky-600 bg-sky-50"
        />
      </div>

      {!canAfford && payable.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Subaccount is underfunded.</p>
            <p className="text-xs mt-0.5">
              Need {fmtUsd(totalDueCents)}, have{" "}
              {sub ? fmtUsd(sub.balanceCents) : "$0.00"}.{" "}
              <Link
                to="/funding"
                className="underline font-medium"
              >
                Prefund via ACH debit pull
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Line items */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Paycheck preview</h3>
          {currentRun && currentRun.status !== "draft" && (
            <RunStatusBadge status={currentRun.status} />
          )}
        </div>
        {!currentRun || currentRun.lineItems.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No employees on this run.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Employee</th>
                <th className="text-right px-5 py-2.5 font-medium">Gross</th>
                <th className="text-right px-5 py-2.5 font-medium">Tax</th>
                <th className="text-right px-5 py-2.5 font-medium">Net</th>
                <th className="text-left px-5 py-2.5 font-medium pl-8">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentRun.lineItems.map((li) => {
                const emp = state.employees.find(
                  (e) => e.id === li.employeeId,
                );
                if (!emp) return null;
                return (
                  <tr key={li.employeeId}>
                    <td className="px-5 py-3">
                      <p className="font-medium">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {emp.bankDisplay ?? "No payout account linked"}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-700">
                      {fmtUsd(li.grossCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">
                      -{fmtUsd(li.taxCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold">
                      {fmtUsd(li.netCents)}
                    </td>
                    <td className="px-5 py-3 pl-8">
                      <LineStatus status={li.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-100">
              <tr>
                <td className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                  Totals
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold">
                  {fmtUsd(currentRun.totalGrossCents)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-gray-500">
                  -{fmtUsd(currentRun.totalGrossCents - currentRun.totalNetCents)}
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold">
                  {fmtUsd(currentRun.totalNetCents)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {/* Past runs */}
      {recentRuns.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent payroll runs</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">
                  Period end
                </th>
                <th className="text-left px-5 py-2.5 font-medium">Employees</th>
                <th className="text-right px-5 py-2.5 font-medium">Net paid</th>
                <th className="text-left px-5 py-2.5 font-medium pl-8">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentRuns.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3">{r.periodEnd}</td>
                  <td className="px-5 py-3">
                    {r.lineItems.filter((l) => l.status !== "skipped").length}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {fmtUsd(r.totalNetCents)}
                  </td>
                  <td className="px-5 py-3 pl-8">
                    <RunStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-2 ${tint}`}>{icon}</div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold mt-3">{value}</p>
    </div>
  );
}

function LineStatus({ status }: { status: PayrollLineItem["status"] }) {
  switch (status) {
    case "draft":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          Draft
        </span>
      );
    case "disbursing":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
          <Loader2 size={12} className="animate-spin" /> Disbursing
        </span>
      );
    case "paid":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={12} /> Paid
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <XCircle size={12} /> Failed
        </span>
      );
    case "skipped":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          Skipped — no bank
        </span>
      );
  }
}

function RunStatusBadge({ status }: { status: PayrollRun["status"] }) {
  const map: Record<PayrollRun["status"], { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-gray-100 text-gray-600" },
    funding: { label: "Funding", cls: "bg-sky-50 text-sky-700" },
    ready: { label: "Ready", cls: "bg-indigo-50 text-indigo-700" },
    running: { label: "Running", cls: "bg-amber-50 text-amber-700" },
    complete: { label: "Complete", cls: "bg-emerald-50 text-emerald-700" },
    partial: { label: "Partial", cls: "bg-orange-50 text-orange-700" },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.cls}`}
    >
      {status === "running" && (
        <Loader2 size={12} className="animate-spin" />
      )}
      {status === "complete" && <CheckCircle2 size={12} />}
      {status === "partial" && <AlertCircle size={12} />}
      {status === "draft" && <Clock size={12} />}
      {m.label}
    </span>
  );
}
