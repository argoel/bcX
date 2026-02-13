/**
 * Jack Henry API Configuration
 *
 * Three integration points:
 * 1. Consumer API (Banno) — OAuth 2.0 + account/balance data
 * 2. jXchange SOAP API — ACH transfers (XferAdd / XferSrch)
 * 3. Enterprise Event System (EES) — Pub/Sub for ACH events
 *
 * Docs: https://jackhenry.dev/open-api-docs/consumer-api/getting-started/
 *       https://jackhenry.dev/jxchange-soap/
 *       https://jackhenry.dev/open-enterprise-api-docs/enterprise-event-system/overview/
 */

// ── Consumer API (Banno Digital Toolkit) ─────────────────────────────
// Uses OAuth 2.0 Authorization Code Grant with PKCE
// Garden Bank is Jack Henry's sandbox financial institution

export const CONSUMER_API = {
  // Garden Bank sandbox environment
  environment: process.env.JH_CONSUMER_ENV || "digital.garden-fi.com",

  get baseUrl() {
    return `https://${this.environment}/a/consumer/api/v0`;
  },

  get authorizationEndpoint() {
    return `https://${this.environment}/a/consumer/api/v0/oidc/auth`;
  },

  get tokenEndpoint() {
    return `https://${this.environment}/a/consumer/api/v0/oidc/token`;
  },

  // Credentials from External Application config in Banno People
  clientId: process.env.JH_CONSUMER_CLIENT_ID || "",
  clientSecret: process.env.JH_CONSUMER_CLIENT_SECRET || "",
  redirectUri: process.env.JH_CONSUMER_REDIRECT_URI || "http://localhost:3001/api/auth/callback",

  // OAuth / OpenID Connect scopes
  // See: https://jackhenry.dev/open-api-docs/consumer-api/overview/authentication/
  scopes: {
    accountsRead: "https://api.banno.com/consumer/auth/accounts.readonly",
    accountsWrite: "https://api.banno.com/consumer/auth/accounts.readwrite",
    offlineAccess: "https://api.banno.com/consumer/auth/offline_access",
    userProfile: "https://api.banno.com/consumer/auth/user.profile.readonly",
    openid: "openid",
  },

  // API paths (appended to baseUrl)
  endpoints: {
    accounts: (userId: string) => `/users/${userId}/accounts`,
    user: (userId: string) => `/users/${userId}`,
  },
};

// ── jXchange SOAP API ────────────────────────────────────────────────
// SOAP-based core banking operations including ACH transfers
// Docs: https://jackhenry.dev/jxchange-soap/api-reference/core-services/xferadd/
//       https://jackhenry.dev/jxchange-soap/api-reference/core-services/xfersrch/

export const JXCHANGE = {
  // Service gateway endpoint — provided during onboarding
  gatewayUrl: process.env.JH_JXCHANGE_GATEWAY_URL || "https://jxchange.jackhenry.com/jxchange/2008/ServiceGateway.svc",

  // SOAP namespace
  namespace: "http://jackhenry.com/jxchange/TPG/2008",

  // OAuth 2.0 credentials (replacing legacy username/password)
  // JH mandating OAuth for all implementations by April 2028
  oauth: {
    tokenUrl: process.env.JH_JXCHANGE_TOKEN_URL || "https://auth.jackhenry.com/oauth2/token",
    clientId: process.env.JH_JXCHANGE_CLIENT_ID || "",
    clientSecret: process.env.JH_JXCHANGE_CLIENT_SECRET || "",
    scope: "jxchange",
  },

  // Institution identification
  institution: {
    routingId: process.env.JH_INST_ROUTING_ID || "",
    environment: process.env.JH_INST_ENV || "PROD",
    consumerName: process.env.JH_CONSUMER_NAME || "FinanceHub",
    consumerProduct: process.env.JH_CONSUMER_PRODUCT || "BillPay",
  },

  // SOAP actions
  actions: {
    xferAdd: "http://jackhenry.com/jxchange/TPG/2008/IServiceGateway/XferAdd",
    xferSrch: "http://jackhenry.com/jxchange/TPG/2008/IServiceGateway/XferSrch",
    xferMod: "http://jackhenry.com/jxchange/TPG/2008/IServiceGateway/XferMod",
    xferDel: "http://jackhenry.com/jxchange/TPG/2008/IServiceGateway/XferDel",
    acctBalInq: "http://jackhenry.com/jxchange/TPG/2008/IServiceGateway/AcctBalInq",
  },

  // Transfer types
  xferTypes: {
    internal: "Xfer",     // Between accounts at same institution
    ach: "ACH",           // External ACH bank-to-bank
    future: "Fut",        // Scheduled future transfer
    wire: "Wire",         // Wire transfer
  },
};

// ── Enterprise Event System (EES) ────────────────────────────────────
// Pub/Sub middleware for banking events, SOAP protocol
// Docs: https://jackhenry.dev/open-enterprise-api-docs/enterprise-event-system/overview/

export const EES = {
  // EES service endpoint
  serviceUrl: process.env.JH_EES_SERVICE_URL || "https://ees.jackhenry.com/EES/Service.svc",

  // SOAP action (always this fixed value for push delivery)
  pushAction: "http://jackhenry.com/ws/EESEventAdd",

  // Our push subscriber endpoint (EES will POST events here)
  subscriberEndpoint: process.env.JH_EES_SUBSCRIBER_URL || "http://localhost:3001/api/ees/events",

  // ACH-related event IDs from the EES Publisher Catalogue
  events: {
    // Event 840: ACH transaction created
    achTransactionCreated: 840,
    // Event 910: ACH NOC (Notification of Change) triggered
    achNotificationOfChange: 910,
    // Event 850: ACH return/rejection
    achReturn: 850,
    // Event 860: ACH settlement completed
    achSettlement: 860,
    // Event 710: Account creation
    accountCreation: 710,
  },

  // Subscription categories for ACH workflow
  subscriptionCategories: [
    "ACH.Transaction.Created",
    "ACH.Transaction.Settled",
    "ACH.Transaction.Returned",
    "ACH.Transaction.Rejected",
    "ACH.NOC.Received",
  ],
};

// ── ACH Status Codes (NACHA) ─────────────────────────────────────────
// https://achdevguide.nacha.org/ach-file-overview

export const ACH_RETURN_CODES = {
  // Administrative returns (rejected by receiver bank — RDFI)
  R01: { code: "R01", reason: "Insufficient Funds", category: "rejected_by_receiver" },
  R02: { code: "R02", reason: "Account Closed", category: "rejected_by_receiver" },
  R03: { code: "R03", reason: "No Account/Unable to Locate Account", category: "rejected_by_receiver" },
  R04: { code: "R04", reason: "Invalid Account Number", category: "rejected_by_receiver" },
  R05: { code: "R05", reason: "Improper Debit to Consumer Account", category: "rejected_by_network" },
  R06: { code: "R06", reason: "Returned per ODFI's Request", category: "rejected_by_network" },
  R07: { code: "R07", reason: "Authorization Revoked by Customer", category: "rejected_by_receiver" },
  R08: { code: "R08", reason: "Payment Stopped", category: "rejected_by_receiver" },
  R09: { code: "R09", reason: "Uncollected Funds", category: "rejected_by_receiver" },
  R10: { code: "R10", reason: "Customer Advises Originator is Not Known", category: "rejected_by_receiver" },
  R11: { code: "R11", reason: "Check Truncation Entry Return", category: "rejected_by_network" },
  R12: { code: "R12", reason: "Branch Sold to Another DFI", category: "rejected_by_receiver" },
  R13: { code: "R13", reason: "RDFI Not Qualified to Participate", category: "rejected_by_network" },
  R14: { code: "R14", reason: "Representative Payee Deceased", category: "rejected_by_receiver" },
  R15: { code: "R15", reason: "Beneficiary or Account Holder Deceased", category: "rejected_by_receiver" },
  R16: { code: "R16", reason: "Account Frozen/Entry Returned per OFAC Instruction", category: "rejected_by_receiver" },
  R20: { code: "R20", reason: "Non-Transaction Account", category: "rejected_by_receiver" },
  R23: { code: "R23", reason: "Credit Entry Refused by Receiver", category: "rejected_by_receiver" },
  R29: { code: "R29", reason: "Corporate Customer Advises Not Authorized", category: "rejected_by_receiver" },
} as const;

export type ACHReturnCode = keyof typeof ACH_RETURN_CODES;
