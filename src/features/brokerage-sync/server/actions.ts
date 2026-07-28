"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { storeEncryptedSecret, readEncryptedSecret, deleteEncryptedSecret } from "@/lib/crypto/encrypted-secrets";
import { robinhoodLogin, robinhoodSubmitMfaCode } from "@/features/brokerage-sync/providers/robinhood/auth";

export interface RobinhoodConnectState {
  step: "credentials" | "mfa" | "done";
  error: string | null;
  pendingSecretId?: string;
  mfaType?: string;
}

interface PendingRobinhoodLogin {
  username: string;
  password: string;
  deviceToken: string;
}

/**
 * Single Server Action driving both steps of the connect flow — see
 * docs/phase-0/10-data-flow.md §1. Credentials never touch Postgres in
 * plaintext at any point: the pending username/password held between step 1
 * and step 2 is itself envelope-encrypted (storeEncryptedSecret), exactly
 * like the final refresh token is.
 */
export async function submitRobinhoodConnect(
  prevState: RobinhoodConnectState,
  formData: FormData,
): Promise<RobinhoodConnectState> {
  const user = await requireUser();

  if (prevState.step === "mfa") {
    return completeMfaStep(user, prevState, formData);
  }

  return startCredentialsStep(user, formData);
}

async function startCredentialsStep(user: User, formData: FormData): Promise<RobinhoodConnectState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { step: "credentials", error: "Username and password are required." };
  }

  const deviceToken = randomUUID();

  try {
    const result = await robinhoodLogin(username, password, deviceToken);

    if (result.status === "mfa_required") {
      const pending: PendingRobinhoodLogin = { username, password, deviceToken };
      const pendingSecretId = await storeEncryptedSecret(JSON.stringify(pending));
      return { step: "mfa", error: null, pendingSecretId, mfaType: result.mfaType };
    }

    await finalizeConnection(user, JSON.stringify({ refreshToken: result.tokens.refreshToken, deviceToken }));
    return { step: "done", error: null };
  } catch (error) {
    return { step: "credentials", error: error instanceof Error ? error.message : "Could not connect to Robinhood." };
  }
}

async function completeMfaStep(
  user: User,
  prevState: RobinhoodConnectState,
  formData: FormData,
): Promise<RobinhoodConnectState> {
  const mfaCode = String(formData.get("mfaCode") ?? "");
  const pendingSecretId = prevState.pendingSecretId;

  if (!mfaCode || !pendingSecretId) {
    return { ...prevState, error: "Enter the code sent to your device." };
  }

  try {
    const pendingRaw = await readEncryptedSecret(pendingSecretId);
    const pending = JSON.parse(pendingRaw) as PendingRobinhoodLogin;

    const result = await robinhoodSubmitMfaCode(pending.username, pending.password, pending.deviceToken, mfaCode);

    await deleteEncryptedSecret(pendingSecretId); // pending username/password no longer needed
    await finalizeConnection(
      user,
      JSON.stringify({ refreshToken: result.tokens.refreshToken, deviceToken: pending.deviceToken }),
    );

    return { step: "done", error: null };
  } catch (error) {
    return { ...prevState, error: error instanceof Error ? error.message : "That code didn't work. Try again." };
  }
}

/** Stores the real (long-lived) credential, creates the auto-portfolio + connection, logs it. */
async function finalizeConnection(user: User, credentialPlaintext: string): Promise<void> {
  const { workspaceId } = await ensureWorkspaceForUser(user);
  const credentialRef = await storeEncryptedSecret(credentialPlaintext);
  const prisma = forUser(user.id);

  const portfolio = await prisma.portfolio.create({
    data: {
      workspaceId,
      name: "Robinhood",
      source: "ROBINHOOD_SYNC",
      brokerageConnection: {
        create: {
          provider: "ROBINHOOD",
          status: "CONNECTED",
          credentialRef,
          scopes: ["read:positions", "read:transactions"],
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      userId: user.id,
      action: "BROKERAGE_CONNECTED",
      metadata: { portfolioId: portfolio.id, provider: "ROBINHOOD" },
    },
  });

  revalidatePath("/settings/integrations/robinhood");
  revalidatePath("/portfolios");
}

export async function disconnectRobinhood(portfolioId: string): Promise<void> {
  const user = await requireUser();
  const { workspaceId } = await ensureWorkspaceForUser(user);
  const prisma = forUser(user.id);

  const connection = await prisma.brokerageConnection.findUnique({ where: { portfolioId } });
  if (!connection) return;

  await deleteEncryptedSecret(connection.credentialRef);
  await prisma.brokerageConnection.update({
    where: { portfolioId },
    data: { status: "DISCONNECTED" },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      userId: user.id,
      action: "BROKERAGE_DISCONNECTED",
      metadata: { portfolioId },
    },
  });

  revalidatePath("/settings/integrations/robinhood");
  revalidatePath("/portfolios");
}
