import { describe, expect, it } from "vitest";

import { computeFileChecksum } from "./checksum";

describe("computeFileChecksum", () => {
  it("computes a stable SHA-256 hex digest for the same content", async () => {
    const file1 = new File(["hello,world\n1,2"], "a.csv", { type: "text/csv" });
    const file2 = new File(["hello,world\n1,2"], "b.csv", { type: "text/csv" }); // different name, same bytes

    const checksum1 = await computeFileChecksum(file1);
    const checksum2 = await computeFileChecksum(file2);

    expect(checksum1).toBe(checksum2);
    expect(checksum1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different checksum for different content", async () => {
    const file1 = new File(["a"], "a.csv");
    const file2 = new File(["b"], "b.csv");

    expect(await computeFileChecksum(file1)).not.toBe(await computeFileChecksum(file2));
  });
});
