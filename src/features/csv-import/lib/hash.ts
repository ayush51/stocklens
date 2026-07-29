/**
 * Deterministic, non-cryptographic string hash (FNV-1a) — used only to
 * derive a stable Transaction.externalId from a row's own content, so
 * importing the same file twice produces the same ids and collides with
 * the existing @@unique([portfolioId, externalId]) constraint instead of
 * creating duplicate transactions. Not a security control; collisions are
 * acceptable and even desirable here (identical rows *should* collide).
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
