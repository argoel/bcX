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
  /** The Google Workspace primary domain, e.g. "acme.com" — also the
   *  tenant key in the app state.  Every user who signs in with an
   *  email at this domain shares the same employer record. */
  gsuiteDomain: string;
  /** Root subaccount id provisioned for this employer */
  rootSubaccountId: string;
  createdAt: string;
}

/** A user who has signed in to myPay as a payroll admin.  Multiple admins
 *  can be active under the same employer (domain). */
export interface Admin {
  email: string;
  name: string;
  picture: string;
  firstSignedInAt: string;
  lastSignedInAt: string;
}

/** Session identifies which tenant (by domain) and which admin is
 *  currently signed in on this device / browser. */
export interface Session {
  domain: string | null;
  adminEmail: string | null;
}

/** Per-employer slice of app state — created the first time someone
 *  from a given domain signs in. */
export interface Tenant {
  employer: Employer;
  admins: Admin[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
}

/* ---- Employees ------------------------------------------------------- */

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface Employee {
  id: string;
  /** ID of the backing Root payee resource.  Present when the employee
   *  was synced from Root or created via Root; absent during migration. */
  rootPayeeId?: string;
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

/** A payee (employee) as stored on Root.  This is the source of truth
 *  for who gets paid out of a subaccount; myPay's `Employee` is a local
 *  HCM enrichment (title, salary, pay frequency) referencing one. */
export interface RootPayee {
  id: string;
  subaccountId: string;
  name: string;
  email: string;
  /** Linked bank-account token, if the payee has completed the Root
   *  Link flow. */
  bankTokenId?: string;
  createdAt: string;
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
