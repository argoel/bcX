/**
 * Transfer Routes — jXchange ACH Integration
 *
 * End-to-end ACH workflow:
 *   1. POST /api/transfers/ach          → Initiate ACH transfer (XferAdd)
 *   2. GET  /api/transfers/:xferKey     → Get transfer details (XferSrch)
 *   3. GET  /api/transfers/account/:id  → List transfers for account
 *   4. GET  /api/transfers/workflow/:key → Get full ACH workflow status
 *
 * Docs: https://jackhenry.dev/jxchange-soap/api-reference/core-services/xferadd/
 *       https://jackhenry.dev/jxchange-soap/api-reference/core-services/xfersrch/
 */

import { Router, type Request, type Response } from "express";
import { JXchangeService } from "../services/jxchange";
import { EESService } from "../services/ees";
import type { ACHTransferRequest } from "../types";

const router = Router();

/**
 * POST /api/transfers/ach
 *
 * Initiate an ACH bank-to-bank transfer via jXchange XferAdd.
 *
 * The request builds a SOAP XferAddRq_MType message with:
 *   - AcctIdFrom_CType: source account at our institution
 *   - ACHXferRec_CType: destination at external institution
 *   - XferType: "ACH"
 *
 * On success, returns the XferKey which is used to:
 *   - Track the transfer through the ACH lifecycle
 *   - Receive EES events about the transfer
 *   - Query transfer details via XferSrch
 *
 * Body:
 * {
 *   fromAccountId: "1234567890",
 *   fromAccountType: "checking",
 *   toRoutingNumber: "021000021",
 *   toAccountNumber: "9876543210",
 *   toAccountType: "checking",
 *   toAccountHolderName: "John Doe",
 *   amount: 150.00,
 *   memo: "Bill payment",
 *   effectiveDate: "2026-02-14"  // optional, defaults to next business day
 * }
 */
router.post("/ach", async (req: Request, res: Response) => {
  const transferReq: ACHTransferRequest = req.body;

  // Validate required fields
  const required = [
    "fromAccountId", "fromAccountType", "toRoutingNumber",
    "toAccountNumber", "toAccountType", "toAccountHolderName", "amount",
  ] as const;

  for (const field of required) {
    if (!transferReq[field]) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }

  if (transferReq.amount <= 0) {
    return res.status(400).json({ error: "Amount must be positive" });
  }

  // Validate routing number (9 digits)
  if (!/^\d{9}$/.test(transferReq.toRoutingNumber)) {
    return res.status(400).json({ error: "Invalid routing number (must be 9 digits)" });
  }

  try {
    // Step 1: Initiate the ACH transfer via jXchange XferAdd
    const result = await JXchangeService.initiateACHTransfer(transferReq);

    if (result.status === "rejected") {
      return res.status(422).json({
        error: "Transfer rejected by the core banking system",
        details: result,
      });
    }

    // Step 2: Start tracking the ACH workflow
    // EES events will update this as the transfer progresses
    const workflow = EESService.startWorkflow(result.xferKey, {
      fromAccountId: transferReq.fromAccountId,
      toAccountId: transferReq.toAccountNumber,
      amount: transferReq.amount,
    });

    res.status(201).json({
      success: true,
      transfer: {
        xferKey: result.xferKey,
        status: result.status,
        effectiveDate: result.effectiveDate,
        traceNumber: result.traceNumber,
      },
      workflow: {
        id: workflow.id,
        currentStatus: workflow.currentStatus,
        scenario: workflow.scenario,
      },
      message: "ACH transfer initiated. Track status via the workflow endpoint.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transfer failed";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/transfers/:xferKey
 *
 * Retrieve details for a specific transfer using jXchange XferSrch.
 * The XferKey was returned by the initial XferAdd call.
 */
router.get("/:xferKey", async (req: Request, res: Response) => {
  const { xferKey } = req.params;

  try {
    const transfer = await JXchangeService.getTransferByKey(xferKey);

    if (!transfer) {
      return res.status(404).json({ error: "Transfer not found" });
    }

    // Also include the workflow status if we're tracking it
    const workflow = EESService.getWorkflow(xferKey);

    res.json({
      transfer,
      workflow: workflow
        ? {
            id: workflow.id,
            scenario: workflow.scenario,
            currentStatus: workflow.currentStatus,
            events: workflow.events,
            completedAt: workflow.completedAt,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/transfers/account/:accountId
 *
 * List all ACH transfers for a given account.
 * Calls XferSrch with XferType = "ACH".
 */
router.get("/account/:accountId", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const accountType = (req.query.accountType as string) || "DDA";

  try {
    const transfers = await JXchangeService.getACHTransfers(accountId, accountType);
    res.json({ transfers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/transfers/workflow/:xferKey
 *
 * Get the full ACH workflow status for a transfer.
 * Shows the complete event timeline and determines the scenario:
 *
 * Scenarios:
 *   - accepted_and_settled: Payment went through successfully
 *   - accepted_rejected_by_network: Accepted but rejected by ACH network
 *   - rejected_by_receiver: Accepted, sent, but rejected by receiver bank
 *   - in_progress: Still processing
 */
router.get("/workflow/:xferKey", (req: Request, res: Response) => {
  const workflow = EESService.getWorkflow(req.params.xferKey);

  if (!workflow) {
    return res.status(404).json({ error: "Workflow not found for this transfer" });
  }

  res.json({ workflow });
});

/**
 * GET /api/transfers/workflows/all
 *
 * List all ACH workflows, optionally filtered by scenario.
 */
router.get("/workflows/all", (req: Request, res: Response) => {
  const scenario = req.query.scenario as string | undefined;
  const workflows = EESService.getAllWorkflows(
    scenario as any
  );
  res.json({ workflows });
});

export default router;
