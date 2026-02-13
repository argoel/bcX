/**
 * Account Routes — Consumer API Integration
 *
 * Uses OAuth access tokens to fetch accounts and balances from
 * the bank via the Jack Henry Consumer API (Banno).
 *
 *   GET /api/accounts/:userId           → List accounts with balances
 *   GET /api/accounts/:userId/:accountId → Single account details
 */

import { Router, type Request, type Response } from "express";
import { ConsumerApiService } from "../services/consumerApi";

const router = Router();

/**
 * GET /api/accounts/:userId
 *
 * Fetch all accounts and balances for a connected user.
 *
 * The Consumer API returns balance data embedded in the accounts response:
 *   - balance: current ledger balance
 *   - availableBalance: available for withdrawal
 *   - availableCredit: available credit line (credit accounts)
 *
 * Docs: https://jackhenry.dev/open-api-docs/consumer-api/api-reference/v0/accounts/details/
 */
router.get("/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const accounts = await ConsumerApiService.getAccounts(userId);

    // Compute aggregate balances across all accounts
    const summary = {
      totalBalance: 0,
      totalAvailable: 0,
      accountCount: accounts.length,
      byType: {} as Record<string, { count: number; balance: number }>,
    };

    for (const acct of accounts) {
      summary.totalBalance += acct.balance;
      summary.totalAvailable += acct.availableBalance;

      if (!summary.byType[acct.accountType]) {
        summary.byType[acct.accountType] = { count: 0, balance: 0 };
      }
      summary.byType[acct.accountType].count++;
      summary.byType[acct.accountType].balance += acct.balance;
    }

    res.json({
      accounts,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch accounts";
    const status = message.includes("not authenticated") ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * GET /api/accounts/:userId/:accountId
 *
 * Fetch details for a single account.
 */
router.get("/:userId/:accountId", async (req: Request, res: Response) => {
  const { userId, accountId } = req.params;

  try {
    const accounts = await ConsumerApiService.getAccounts(userId);
    const account = accounts.find((a) => a.id === accountId);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch account";
    res.status(500).json({ error: message });
  }
});

export default router;
