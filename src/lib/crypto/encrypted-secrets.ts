import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

import { env } from "@/lib/env";
import { prismaService } from "@/lib/db/prisma-service";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // GCM standard 96-bit nonce

function getKey(): Buffer {
  return Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "base64");
}

/**
 * Envelope-encrypts a secret (e.g. a Robinhood session token) and stores
 * only the ciphertext in Postgres. Returns the row id — this is what
 * BrokerageConnection.credentialRef points at, never the plaintext.
 *
 * Uses prismaService (service_role_app) deliberately: EncryptedSecret has no
 * app_user grant at all, not even SELECT — this helper is inherently
 * system-level code, matching how Company/FinancialStatement writes work.
 * See docs/phase-0/09-security-model.md §3.2.
 */
export async function storeEncryptedSecret(plaintext: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const secret = await prismaService.encryptedSecret.create({
    data: { ciphertext, iv, authTag },
  });

  return secret.id;
}

/** Decrypts a secret by its EncryptedSecret.id. Throws if the id doesn't exist. */
export async function readEncryptedSecret(secretId: string): Promise<string> {
  const secret = await prismaService.encryptedSecret.findUniqueOrThrow({ where: { id: secretId } });

  const decipher = createDecipheriv(ALGORITHM, getKey(), secret.iv);
  decipher.setAuthTag(secret.authTag);
  const plaintext = Buffer.concat([decipher.update(secret.ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}

/** Idempotent — deleting an already-gone secret is not an error. */
export async function deleteEncryptedSecret(secretId: string): Promise<void> {
  await prismaService.encryptedSecret.delete({ where: { id: secretId } }).catch(() => undefined);
}
