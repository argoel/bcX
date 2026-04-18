import type { Employee, PayFrequency, PayrollLineItem } from "../types";
import { toCents } from "./money";

/** Number of pay periods per year for a given frequency. */
export function periodsPerYear(f: PayFrequency): number {
  switch (f) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "semimonthly":
      return 24;
    case "monthly":
      return 12;
  }
}

/** Gross per period in cents. */
export function grossPerPeriodCents(emp: Employee): number {
  return Math.round(toCents(emp.annualSalary) / periodsPerYear(emp.payFrequency));
}

/** Simplified withholding: 22% federal + 7.65% FICA. */
const TAX_RATE = 0.22 + 0.0765;

export function buildLineItem(emp: Employee): PayrollLineItem {
  const gross = grossPerPeriodCents(emp);
  const tax = Math.round(gross * TAX_RATE);
  const net = gross - tax;
  return {
    employeeId: emp.id,
    grossCents: gross,
    taxCents: tax,
    netCents: net,
    status: emp.rootBankToken ? "draft" : "skipped",
  };
}
