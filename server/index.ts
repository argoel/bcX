/**
 * FinanceHub Backend Server
 *
 * Express server integrating with Jack Henry APIs:
 *   - Consumer API (Banno): Three-legged OAuth + account/balance data
 *   - jXchange SOAP API: ACH bank-to-bank transfers
 *   - Enterprise Event System (EES): ACH event pub/sub
 *
 * API Routes:
 *   /api/auth/*       → OAuth flow (connect, callback, refresh, disconnect)
 *   /api/accounts/*   → Account listing and balances
 *   /api/transfers/*  → ACH transfer initiation and tracking
 *   /api/ees/*        → EES event subscription and webhook receiver
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import accountRoutes from "./routes/accounts";
import transferRoutes from "./routes/transfers";
import eesRoutes from "./routes/ees";
import { EESService } from "./services/ees";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser());

// Parse JSON for REST endpoints
app.use(express.json());

// Parse raw XML for EES SOAP push events
// The /api/ees/events endpoint receives SOAP XML, not JSON
app.use("/api/ees/events", express.text({ type: "text/xml" }));

// ── Routes ───────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/ees", eesRoutes);

// ── Health check ─────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    integrations: {
      consumerApi: {
        description: "Jack Henry Consumer API (Banno)",
        environment: process.env.JH_CONSUMER_ENV || "digital.garden-fi.com",
        features: ["Three-legged OAuth with PKCE", "Account listing", "Balance retrieval"],
      },
      jxchange: {
        description: "jXchange SOAP API",
        features: ["XferAdd (ACH transfers)", "XferSrch (transfer lookup)"],
        authMethod: "OAuth 2.0 (transitioning from username/password)",
      },
      ees: {
        description: "Enterprise Event System",
        deliveryMethod: "PUSH (SOAP)",
        subscribedEvents: {
          840: "ACH Transaction Created",
          850: "ACH Return/Rejection",
          860: "ACH Settlement Completed",
          910: "ACH Notification of Change",
        },
      },
    },
  });
});

// ── ACH Workflow documentation endpoint ──────────────────────────────

app.get("/api/ach-scenarios", (_req, res) => {
  res.json({
    description: "ACH Transfer Scenarios handled by the system",
    workflow: {
      step1: "Subscribe to ACH events via EES (events 840, 850, 860, 910)",
      step2: "Initiate ACH transfer via jXchange XferAdd with ACHXferRec_CType",
      step3: "Receive EES events as the transfer progresses",
      step4: "Retrieve details via XferSrch using the XferKey",
    },
    scenarios: {
      accepted_and_settled: {
        description: "Payment accepted, initiated with ACH network, and settled",
        eventFlow: [
          "XferAdd → accepted (XferKey returned)",
          "EES Event 840 → ACH Transaction Created",
          "EES Event 860 → ACH Settlement Completed",
        ],
        finalStatus: "settled",
      },
      accepted_rejected_by_network: {
        description: "Payment accepted and validated, but rejected by the ACH network",
        eventFlow: [
          "XferAdd → accepted (XferKey returned)",
          "EES Event 840 → ACH Transaction Created",
          "EES Event 850 → ACH Return (R05, R06, R11, R13 — network-level codes)",
        ],
        returnCodes: ["R05 (Improper Debit)", "R06 (Returned per ODFI)", "R11 (Check Truncation)", "R13 (RDFI Not Qualified)"],
        finalStatus: "returned",
      },
      rejected_by_receiver: {
        description: "Payment accepted, initiated with ACH network, but rejected by the receiver bank (RDFI)",
        eventFlow: [
          "XferAdd → accepted (XferKey returned)",
          "EES Event 840 → ACH Transaction Created",
          "EES Event 850 → ACH Return (R01-R04, R07-R10 — receiver bank codes)",
        ],
        returnCodes: [
          "R01 (Insufficient Funds)", "R02 (Account Closed)",
          "R03 (No Account)", "R04 (Invalid Account Number)",
          "R07 (Authorization Revoked)", "R08 (Payment Stopped)",
          "R09 (Uncollected Funds)", "R10 (Customer Advises Not Known)",
        ],
        finalStatus: "returned",
      },
    },
  });
});

// ── Initialize EES subscription on startup ───────────────────────────

EESService.createACHSubscription();

// Register a default event handler for logging
EESService.onEvent((event) => {
  console.log(`[ACH Event] ${event.eventId} - ${event.payload.eventAction}`);
  if (event.payload.xferKey) {
    const workflow = EESService.getWorkflow(event.payload.xferKey);
    if (workflow?.completedAt) {
      console.log(`[ACH Workflow] Transfer ${event.payload.xferKey} completed: ${workflow.scenario}`);
    }
  }
});

// ── Start server ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`FinanceHub API server running on port ${PORT}`);
  console.log(`Consumer API environment: ${process.env.JH_CONSUMER_ENV || "digital.garden-fi.com"}`);
  console.log(`EES push endpoint: ${process.env.JH_EES_SUBSCRIBER_URL || `http://localhost:${PORT}/api/ees/events`}`);
});

export default app;
