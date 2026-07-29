import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("returns 'just now' for less than a minute ago", () => {
    expect(formatRelativeTime("2026-07-29T11:59:30.000Z", now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    expect(formatRelativeTime("2026-07-29T11:45:00.000Z", now)).toBe("15m ago");
  });

  it("formats hours ago", () => {
    expect(formatRelativeTime("2026-07-29T09:00:00.000Z", now)).toBe("3h ago");
  });

  it("formats days ago", () => {
    expect(formatRelativeTime("2026-07-26T12:00:00.000Z", now)).toBe("3d ago");
  });

  it("falls back to a locale date string beyond a week", () => {
    const result = formatRelativeTime("2026-07-01T12:00:00.000Z", now);
    expect(result).not.toMatch(/ago/);
  });
});
