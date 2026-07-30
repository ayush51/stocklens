import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-with-timeout";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("resolves normally when the underlying fetch completes before the deadline", async () => {
    const mockResponse = new Response("ok");
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWithTimeout("https://example.com", {}, 10_000);

    expect(result).toBe(mockResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("aborts the request once the timeout elapses", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_input: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithTimeout("https://example.com", {}, 50);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });

  it("passes through caller-supplied init options alongside the abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithTimeout("https://example.com", { headers: { "User-Agent": "test" } }, 10_000);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ headers: { "User-Agent": "test" } }),
    );
  });
});
