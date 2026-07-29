/**
 * SHA-256 of the file's contents, computed entirely client-side via the
 * Web Crypto API. The raw file itself is never sent to the server — only
 * this checksum, the filename, and the already-parsed transaction rows
 * are (see the "store filename + checksum, not the raw file" requirement).
 */
export async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
