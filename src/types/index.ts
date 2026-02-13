export interface BankAccount {
  id: string;
  bankName: string;
  bankLogo: string;
  accountType: "checking" | "savings" | "credit";
  accountNumber: string; // masked
  balance: number;
  currency: string;
  connected: boolean;
  connectedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  category: string;
  amount: number; // negative = debit, positive = credit
  merchant: string;
  status: "posted" | "pending";
}

export interface Payee {
  id: string;
  name: string;
  nickname?: string;
  accountNumber: string;     // full account number (masked in display)
  routingNumber: string;     // 9-digit ABA routing number
  bankName: string;          // resolved bank name from routing number
  accountType: "checking" | "savings";
  email?: string;
  phone?: string;
  address?: string;
  status: "verified" | "pending" | "failed";
  verifiedAt?: string;
  createdAt: string;
  lastPaymentDate?: string;
  totalPayments: number;
}

export interface Bill {
  id: string;
  name: string;
  payee: string;
  payeeId?: string;          // links to Payee record
  amount: number;
  frequency: "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
  autoPay: boolean;
  payFromAccountId: string;
  category: string;
  status: "active" | "paused";
}
