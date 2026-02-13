/**
 * OAuth Authentication Routes
 *
 * Three-legged OAuth flow with Garden Bank:
 *   GET  /api/auth/connect       → Redirect to bank's authorization page
 *   GET  /api/auth/callback      → Handle bank redirect with auth code
 *   POST /api/auth/refresh       → Refresh an expired token
 *   GET  /api/auth/status/:userId → Check connection status
 *   POST /api/auth/disconnect    → Disconnect a linked bank
 */

import { Router, type Request, type Response } from "express";
import { ConsumerApiService } from "../services/consumerApi";

const router = Router();

/**
 * GET /api/auth/connect
 *
 * Initiates the three-legged OAuth flow. Generates PKCE parameters
 * and redirects the user to Garden Bank's authorization page.
 *
 * Query params:
 *   institutionEnv (optional) - Override the institution environment
 *                               (defaults to digital.garden-fi.com)
 */
router.get("/connect", (req: Request, res: Response) => {
  const institutionEnv = req.query.institutionEnv as string | undefined;

  const { url, state } = ConsumerApiService.buildAuthorizationUrl(institutionEnv);

  // Store state in session cookie for verification on callback
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: "lax",
  });

  res.redirect(url);
});

/**
 * GET /api/auth/callback
 *
 * OAuth callback endpoint — Garden Bank redirects here after the user
 * authenticates and consents. Exchanges the authorization code for
 * access + identity tokens.
 *
 * Query params (set by the bank):
 *   code  - Authorization code
 *   state - State parameter for CSRF verification
 */
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Handle authorization errors (user denied consent, etc.)
  if (error) {
    return res.redirect(
      `/?auth_error=${encodeURIComponent(String(error_description || error))}`
    );
  }

  if (!code || !state) {
    return res.status(400).json({
      error: "Missing authorization code or state parameter",
    });
  }

  try {
    const userToken = await ConsumerApiService.exchangeCodeForTokens(
      String(code),
      String(state)
    );

    // Clear the state cookie
    res.clearCookie("oauth_state");

    // Redirect to frontend with the user ID
    res.redirect(
      `/accounts?connected=true&userId=${encodeURIComponent(userToken.userId)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    res.redirect(`/?auth_error=${encodeURIComponent(message)}`);
  }
});

/**
 * POST /api/auth/refresh
 *
 * Refresh an expired access token.
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const token = await ConsumerApiService.refreshAccessToken(userId);
    res.json({
      success: true,
      expiresAt: token.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    res.status(401).json({ error: message });
  }
});

/**
 * GET /api/auth/status/:userId
 *
 * Check if a user has an active bank connection.
 */
router.get("/status/:userId", (req: Request, res: Response) => {
  const token = ConsumerApiService.getUserToken(req.params.userId);

  if (!token) {
    return res.json({ connected: false });
  }

  res.json({
    connected: true,
    institutionId: token.institutionId,
    expiresAt: token.expiresAt,
    isExpired: token.expiresAt < Date.now(),
  });
});

/**
 * POST /api/auth/disconnect
 *
 * Disconnect a user's linked bank account.
 */
router.post("/disconnect", (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  ConsumerApiService.disconnectUser(userId);
  res.json({ success: true });
});

export default router;
