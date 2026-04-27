/**
 * Backend types for Jack Henry integrations
 */

// ── Consumer API (OAuth / Accounts) ──────────────────────────────────

export interface OAuthState {
  codeVerifier: string;
  state: string;
  institutionEnvironment: string;
  redirectUri: string;
  createdAt: number;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface UserToken {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  institutionId: string;
}

export interface ConsumerAccount {
  id: string;
  accountNumber: string;
  accountNumberMasked: string;
  accountType: "checking" | "savings" | "credit" | "loan" | "mortgage";
  name: string;
  balance: number;
  availableBalance: number;
  availableCredit?: number;
  currency: string;
  institutionId: string;
  status: "active" | "closed" | "dormant";
}

// ── jXchange (ACH Transfers) ─────────────────────────────────────────

export type XferType = "Xfer" | "ACH" | "Fut" | "Wire";

export interface ACHTransferRequest {
  fromAccountId: string;
  fromAccountType: "checking" | "savings";
  toRoutingNumber: string;
  toAccountNumber: string;
  toAccountType: "checking" | "savings";
  toAccountHolderName: string;
  amount: number;
  currency?: string;
  memo?: string;
  effectiveDate?: string;  // ISO date, defaults to next business day
  achCompanyName?: string;
  achCompanyId?: string;
  achEntryDescription?: string;
}

export interface ACHTransferResponse {
  xferKey: string;
  status: "accepted" | "rejected";
  rsStat: string;
  message?: string;
  effectiveDate: string;
  traceNumber?: string;
}

export interface XferSearchResult {
  xferKey: string;
  fromAccountId: string;
  fromAccountType: string;
  toAccountId: string;
  toAccountType: string;
  amount: number;
  xferType: XferType;
  status: ACHTransactionStatus;
  effectiveDate: string;
  createDate: string;
  achDetails?: {
    traceNumber: string;
    companyName: string;
    companyId: string;
    entryDescription: string;
    returnCode?: string;
    returnReason?: string;
    settlementDate?: string;
  };
}

export type ACHTransactionStatus =
  | "pending"           // Created, not yet submitted to ACH network
  | "submitted"         // Submitted to ACH network (ODFI)
  | "accepted"          // Accepted by ACH network
  | "settled"           // Settled — funds transferred successfully
  | "returned"          // Returned by RDFI (receiver bank)
  | "rejected"          // Rejected by ACH network
  | "cancelled"         // Cancelled before submission
  | "noc_received";     // Notification of Change received

// ── Enterprise Event System (EES) ────────────────────────────────────

export interface EESEvent {
  eventId: number;
  eventType: string;
  eventTimestamp: string;
  institutionRoutingId: string;
  payload: EESEventPayload;
}

export interface EESEventPayload {
  // Common fields
  eventCategory: string;
  eventAction: string;
  // ACH-specific fields
  xferKey?: string;
  traceNumber?: string;
  amount?: number;
  fromAccountId?: string;
  toAccountId?: string;
  toRoutingNumber?: string;
  achReturnCode?: string;
  achReturnReason?: string;
  settlementDate?: string;
  effectiveDate?: string;
  status?: ACHTransactionStatus;
}

export interface EESSubscription {
  subscriptionId: string;
  eventIds: number[];
  deliveryMethod: "push" | "pull";
  endpoint?: string;      // For push delivery
  status: "active" | "inactive";
  createdAt: string;
}

// ── ACH Workflow Tracking ────────────────────────────────────────────

export type ACHScenario =
  | "accepted_and_settled"          // Happy path: accepted → settled
  | "accepted_rejected_by_network"  // Accepted, validated, but rejected by ACH network
  | "rejected_by_receiver";         // Accepted, sent to RDFI, rejected by receiver bank

export interface ACHWorkflowEvent {
  id: string;
  xferKey: string;
  scenario: ACHScenario | "in_progress";
  events: ACHWorkflowStep[];
  currentStatus: ACHTransactionStatus;
  createdAt: string;
  completedAt?: string;
}

export interface ACHWorkflowStep {
  step: number;
  action: string;
  status: ACHTransactionStatus;
  timestamp: string;
  details?: Record<string, unknown>;
}
