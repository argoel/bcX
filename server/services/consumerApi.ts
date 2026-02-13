/**
 * Jack Henry Consumer API Service
 *
 * Implements three-legged OAuth 2.0 with PKCE for the Banno Consumer API.
 * Uses Garden Bank (digital.garden-fi.com) as the sandbox environment.
 *
 * Flow:
 *   1. Generate PKCE code_verifier + code_challenge
 *   2. Redirect user to Garden Bank's authorization URL
 *   3. User authenticates at the bank and consents
 *   4. Bank redirects back with authorization code
 *   5. Exchange code + code_verifier for access_token + id_token
 *   6. Use access_token to call Consumer API endpoints
 *
 * Docs: https://jackhenry.dev/open-api-docs/consumer-api/overview/authentication/
 *       https://jackhenry.dev/open-api-docs/consumer-api/api-reference/v0/accounts/details/
 */

import crypto from "crypto";
import { CONSUMER_API } from "../config/jackhenry";
import type {
  OAuthState,
  TokenResponse,
  UserToken,
  ConsumerAccount,
} from "../types";

// ── PKCE Utilities ───────────────────────────────────────────────────

/**
 * Generate a cryptographically random code_verifier (43-128 bytes)
 * per RFC 7636 / Jack Henry PKCE requirements.
 */
function generateCodeVerifier(): string {
  // 64 random bytes → base64url → 86 chars (within 43-128 range)
  return crypto.randomBytes(64).toString("base64url");
}

/**
 * Derive the code_challenge from the code_verifier using S256.
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a cryptographic random state parameter for CSRF protection.
 */
function generateState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ── In-memory stores (replace with Redis/DB in production) ───────────

const pendingAuthFlows = new Map<string, OAuthState>();
const userTokens = new Map<string, UserToken>();

// ── Consumer API Service ─────────────────────────────────────────────

export const ConsumerApiService = {
  /**
   * Step 1: Build the authorization URL for three-legged OAuth.
   *
   * The user's browser is redirected to Garden Bank's auth page where they
   * log in with their bank credentials (never shared with us).
   *
   * @param institutionEnv - Optional override (defaults to Garden Bank sandbox)
   * @returns The full authorization URL to redirect the user to
   */
  buildAuthorizationUrl(institutionEnv?: string): {
    url: string;
    state: string;
  } {
    const env = institutionEnv || CONSUMER_API.environment;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store the PKCE verifier and state for the callback
    // (keyed by state parameter for lookup during token exchange)
    const oauthState: OAuthState = {
      codeVerifier,
      state,
      institutionEnvironment: env,
      redirectUri: CONSUMER_API.redirectUri,
      createdAt: Date.now(),
    };
    pendingAuthFlows.set(state, oauthState);

    // Build the authorization URL per JH docs:
    // https://jackhenry.dev/open-api-docs/consumer-api/quickstarts/authenticationcommandline/
    const scopes = [
      CONSUMER_API.scopes.openid,
      CONSUMER_API.scopes.accountsRead,
      CONSUMER_API.scopes.userProfile,
      CONSUMER_API.scopes.offlineAccess,
    ].join(" ");

    const authBaseUrl = institutionEnv
      ? `https://${env}/a/consumer/api/v0/oidc/auth`
      : CONSUMER_API.authorizationEndpoint;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CONSUMER_API.clientId,
      redirect_uri: CONSUMER_API.redirectUri,
      scope: scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return {
      url: `${authBaseUrl}?${params.toString()}`,
      state,
    };
  },

  /**
   * Step 2: Exchange the authorization code for tokens.
   *
   * Called when Garden Bank redirects back to our callback URL with
   * the authorization code. We exchange it along with the PKCE
   * code_verifier for access + identity tokens.
   *
   * @param code - Authorization code from the callback
   * @param state - State parameter to match against our stored flow
   */
  async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<UserToken> {
    // Retrieve the pending auth flow
    const oauthState = pendingAuthFlows.get(state);
    if (!oauthState) {
      throw new Error("Invalid or expired OAuth state. Please restart the authorization flow.");
    }

    // Clean up — never reuse a code_verifier
    pendingAuthFlows.delete(state);

    // Verify flow hasn't expired (10 minute window)
    if (Date.now() - oauthState.createdAt > 10 * 60 * 1000) {
      throw new Error("Authorization flow expired. Please try again.");
    }

    // Build token endpoint URL for the specific institution
    const tokenUrl = `https://${oauthState.institutionEnvironment}/a/consumer/api/v0/oidc/token`;

    // Exchange code for tokens
    // https://jackhenry.dev/open-api-docs/consumer-api/overview/authentication/
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: oauthState.redirectUri,
        client_id: CONSUMER_API.clientId,
        client_secret: CONSUMER_API.clientSecret,
        code_verifier: oauthState.codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${error}`);
    }

    const tokenData: TokenResponse = await response.json();

    // Decode the ID token to extract user info (it's a JWT)
    const idTokenPayload = JSON.parse(
      Buffer.from(tokenData.id_token.split(".")[1], "base64").toString()
    );

    const userToken: UserToken = {
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      userId: idTokenPayload.sub,
      institutionId: oauthState.institutionEnvironment,
    };

    // Store the tokens for subsequent API calls
    userTokens.set(userToken.userId, userToken);

    return userToken;
  },

  /**
   * Step 3: Refresh an expired access token using the refresh token.
   *
   * The offline_access scope must have been requested during authorization.
   */
  async refreshAccessToken(userId: string): Promise<UserToken> {
    const existing = userTokens.get(userId);
    if (!existing?.refreshToken) {
      throw new Error("No refresh token available. User must re-authorize.");
    }

    const tokenUrl = `https://${existing.institutionId}/a/consumer/api/v0/oidc/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: existing.refreshToken,
        client_id: CONSUMER_API.clientId,
        client_secret: CONSUMER_API.clientSecret,
      }),
    });

    if (!response.ok) {
      // Refresh token may be revoked — user needs to re-auth
      userTokens.delete(userId);
      throw new Error("Token refresh failed. User must re-authorize.");
    }

    const tokenData: TokenResponse = await response.json();

    const updated: UserToken = {
      ...existing,
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      refreshToken: tokenData.refresh_token ?? existing.refreshToken,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    userTokens.set(userId, updated);
    return updated;
  },

  /**
   * Get a valid access token, refreshing if necessary.
   */
  async getValidToken(userId: string): Promise<string> {
    const token = userTokens.get(userId);
    if (!token) {
      throw new Error("User not authenticated. Please connect your bank account.");
    }

    // Refresh if token expires within 60 seconds
    if (token.expiresAt - Date.now() < 60_000) {
      const refreshed = await this.refreshAccessToken(userId);
      return refreshed.accessToken;
    }

    return token.accessToken;
  },

  /**
   * Fetch user's accounts and balances from the Consumer API.
   *
   * GET /users/{userId}/accounts
   * Scope: https://api.banno.com/consumer/auth/accounts.readonly
   *
   * Balance fields returned per account:
   *  - balance: current ledger balance
   *  - availableBalance: available for withdrawal
   *  - availableCredit: available credit (credit accounts only)
   *
   * Docs: https://jackhenry.dev/open-api-docs/consumer-api/api-reference/v0/accounts/details/
   */
  async getAccounts(userId: string): Promise<ConsumerAccount[]> {
    const accessToken = await this.getValidToken(userId);
    const token = userTokens.get(userId)!;

    const url = `https://${token.institutionId}/a/consumer/api/v0/users/${userId}/accounts`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token may be invalid — try refresh
        const refreshed = await this.refreshAccessToken(userId);
        const retryResponse = await fetch(url, {
          headers: {
            Authorization: `Bearer ${refreshed.accessToken}`,
            Accept: "application/json",
          },
        });
        if (!retryResponse.ok) {
          throw new Error(`Failed to fetch accounts: ${retryResponse.status}`);
        }
        return this.mapAccountsResponse(await retryResponse.json(), token.institutionId);
      }
      throw new Error(`Failed to fetch accounts: ${response.status}`);
    }

    return this.mapAccountsResponse(await response.json(), token.institutionId);
  },

  /**
   * Map the Banno API response to our internal ConsumerAccount format.
   */
  mapAccountsResponse(data: any, institutionId: string): ConsumerAccount[] {
    const accounts = Array.isArray(data) ? data : data?.accounts ?? [];

    return accounts.map((acct: any) => ({
      id: acct.id,
      accountNumber: acct.accountNumber || "",
      accountNumberMasked: acct.accountNumberMasked || `****${(acct.accountNumber || "").slice(-4)}`,
      accountType: mapAccountType(acct.accountType || acct.type),
      name: acct.name || acct.nickname || "Account",
      balance: acct.balance ?? 0,
      availableBalance: acct.availableBalance ?? acct.balance ?? 0,
      availableCredit: acct.availableCredit,
      currency: acct.currency || "USD",
      institutionId,
      status: acct.status || "active",
    }));
  },

  /**
   * Get the stored token for a user (for status checking).
   */
  getUserToken(userId: string): UserToken | undefined {
    return userTokens.get(userId);
  },

  /**
   * Disconnect a user's linked bank (revoke tokens).
   */
  disconnectUser(userId: string): void {
    userTokens.delete(userId);
  },
};

function mapAccountType(type: string): ConsumerAccount["accountType"] {
  const normalized = (type || "").toLowerCase();
  if (normalized.includes("check")) return "checking";
  if (normalized.includes("sav")) return "savings";
  if (normalized.includes("credit") || normalized.includes("card")) return "credit";
  if (normalized.includes("loan")) return "loan";
  if (normalized.includes("mortgage")) return "mortgage";
  return "checking";
}
