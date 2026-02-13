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

export interface Bill {
  id: string;
  name: string;
  payee: string;
  amount: number;
  frequency: "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
  autoPay: boolean;
  payFromAccountId: string;
  category: string;
  status: "active" | "paused";
}
