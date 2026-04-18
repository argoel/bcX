/* ────────────────────────────────────────────────────────────────────────
   myPay — domain types.

   The app is a thin UI over a Root Sandbox account.  myPay keeps its own
   HCM records (employers, employees) while Root holds the real money:
   a subaccount per employer, tokenized bank references ("bank tokens")
   per employer and per employee, and the ACH/RTP transfers between them.

   Types here intentionally mirror the shape we expect from Root's
   `root-pay-js-sdk` and sandbox REST API, so swapping the mocked service
   for real calls is mostly a matter of URL + key.
   ──────────────────────────────────────────────────────────────────────── */

/* ---- Employer / auth ------------------------------------------------- */

export interface Employer {
  id: string;
  companyName: string;
  /** The Google Workspace primary domain, e.g. "acme.com" */
  gsuiteDomain: string;
  /** Admin who signed in via GSuite */
  admin: {
    email: string;
    name: string;
    picture: string;
  };
  /** Root subaccount id provisioned for this employer */
  rootSubaccountId: string;
  createdAt: string;
}

/* ---- Employees ------------------------------------------------------- */

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  /** Annual salary in USD; we derive weekly gross from this. */
  annualSalary: number;
  payFrequency: PayFrequency;
  /** Linked Root bank-account token (if the employee has completed link flow) */
  rootBankToken?: string;
  /** Display-only mask e.g. "Chase ••4521" */
  bankDisplay?: string;
  createdAt: string;
}

/* ---- Root resources (mirrored client-side for UI) -------------------- */

export interface RootSubaccount {
  id: string;
  employerId: string;
  /** Available balance in USD cents */
  balanceCents: number;
  /** Pending incoming ACH debits (prefunding) in cents */
  pendingInCents: number;
  /** Pending outgoing disbursements in cents */
  pendingOutCents: number;
}

/** A tokenized bank account stored on Root. */
export interface RootBankToken {
  id: string;
  /** Who this bank belongs to.  "employer" = operating account (debit pull),
   *  "employee" = payee account (credit push). */
  ownerType: "employer" | "employee";
  ownerId: string;
  bankName: string;
  accountType: "checking" | "savings";
  last4: string;
  /** Whether the employer explicitly authorized ACH debit pulls. */
  achDebitAuthorized: boolean;
  createdAt: string;
}

/** ACH debit pull OR ACH/RTP disbursement. */
export interface RootTransfer {
  id: string;
  subaccountId: string;
  /** debit-in = prefunding (money into subaccount) */
  /** credit-out = disbursement (money out to employee) */
  type: "debit-in" | "credit-out";
  /** For debit-in this is the employer's bank token; for credit-out it is
   *  the employee's bank token. */
  bankTokenId: string;
  amountCents: number;
  rail: "ach" | "rtp";
  status: "pending" | "settled" | "failed";
  /** Associated employee id for credit-out disbursements. */
  employeeId?: string;
  /** Associated payroll run for credit-out disbursements. */
  payrollRunId?: string;
  /** Memo visible on the bank statement. */
  memo: string;
  createdAt: string;
  settledAt?: string;
}

/* ---- Payroll --------------------------------------------------------- */

export interface PayrollLineItem {
  employeeId: string;
  grossCents: number;
  /** Simplified: a flat 22% federal + 7.65% FICA. */
  taxCents: number;
  netCents: number;
  /** Populated once the disbursement is initiated. */
  transferId?: string;
  status: "draft" | "disbursing" | "paid" | "failed" | "skipped";
}

export interface PayrollRun {
  id: string;
  employerId: string;
  /** ISO date of the pay-period end (Friday). */
  periodEnd: string;
  status: "draft" | "funding" | "ready" | "running" | "complete" | "partial";
  lineItems: PayrollLineItem[];
  /** Sum of net paychecks in cents (what we need to have on hand). */
  totalNetCents: number;
  totalGrossCents: number;
  createdAt: string;
  completedAt?: string;
}

/* ---- Root activity log (visible in the UI) --------------------------- */

export interface RootActivityEntry {
  id: string;
  /** ISO timestamp */
  at: string;
  /** Conceptual API call, e.g. "POST /v1/subaccounts" */
  endpoint: string;
  /** Human summary */
  summary: string;
  /** Redacted request/response snippet for the curious */
  request?: unknown;
  response?: unknown;
  status: "ok" | "error";
}
