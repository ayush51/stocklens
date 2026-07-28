/**
 * Robinhood has no official public API. This targets the same
 * long-standing unofficial/reverse-engineered surface used by established
 * open-source tools (e.g. robin-stocks) — it is NOT a verified spec, and
 * Robinhood can change it without notice. This has not been tested against
 * a live account (no credentials are available to do that safely from
 * here) — expect to need small adjustments once it's actually exercised
 * through the real connect flow. See docs/phase-0/11-implementation-plan.md
 * Phase 2 and docs/phase-0/09-security-model.md §3.
 *
 * Read-only by construction: this module only ever exchanges credentials
 * for a token and refreshes that token. It has no method that could place
 * an order, move money, or modify the account — see
 * shared/contracts/brokerage-sync-provider.ts.
 */

const TOKEN_URL = "https://api.robinhood.com/oauth2/token/";

// Robinhood's mobile-app OAuth client id — publicly known/reused across the
// unofficial-API tooling ecosystem, not a secret. Required by the token
// endpoint regardless of which client is calling it.
const OAUTH_CLIENT_ID = "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS";

export interface RobinhoodTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RobinhoodMfaRequired {
  status: "mfa_required";
  mfaType: string;
}

export interface RobinhoodAuthenticated {
  status: "authenticated";
  tokens: RobinhoodTokens;
}

export type RobinhoodLoginResult = RobinhoodAuthenticated | RobinhoodMfaRequired;

interface TokenResponseBody {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  mfa_required?: boolean;
  mfa_type?: string;
  detail?: string;
}

async function requestToken(body: Record<string, string>): Promise<RobinhoodLoginResult> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: OAUTH_CLIENT_ID,
      scope: "internal",
      expires_in: 86400,
      ...body,
    }),
  });

  const data = (await response.json()) as TokenResponseBody;

  if (data.mfa_required) {
    return { status: "mfa_required", mfaType: data.mfa_type ?? "sms" };
  }

  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.detail ?? `Robinhood login failed (${response.status})`);
  }

  return {
    status: "authenticated",
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 86400,
    },
  };
}

/**
 * First step of connecting: username + password. May come back needing an
 * MFA code (SMS/authenticator) before Robinhood issues tokens — the caller
 * (the connect Server Action) is responsible for holding the username/
 * password/deviceToken just long enough to complete step two, encrypted at
 * rest via storeEncryptedSecret, never in a plain session/cookie.
 */
export async function robinhoodLogin(
  username: string,
  password: string,
  deviceToken: string,
): Promise<RobinhoodLoginResult> {
  return requestToken({
    grant_type: "password",
    username,
    password,
    device_token: deviceToken,
  });
}

/** Second step, only when robinhoodLogin() returned mfa_required. */
export async function robinhoodSubmitMfaCode(
  username: string,
  password: string,
  deviceToken: string,
  mfaCode: string,
): Promise<RobinhoodAuthenticated> {
  const result = await requestToken({
    grant_type: "password",
    username,
    password,
    device_token: deviceToken,
    mfa_code: mfaCode,
  });

  if (result.status !== "authenticated") {
    throw new Error("Robinhood still requires additional verification after the MFA code.");
  }

  return result;
}

/** Used by the adapter before every sync run — access tokens are short-lived. */
export async function robinhoodRefreshToken(refreshToken: string, deviceToken: string): Promise<RobinhoodTokens> {
  const result = await requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    device_token: deviceToken,
  });

  if (result.status !== "authenticated") {
    throw new Error("Robinhood token refresh unexpectedly required MFA — the connection needs to be re-established.");
  }

  return result.tokens;
}
