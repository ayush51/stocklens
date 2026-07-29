import { describe, expect, it } from "vitest";

import { stripHtmlToText } from "./strip-html";

describe("stripHtmlToText", () => {
  it("removes tags while keeping text content", () => {
    expect(stripHtmlToText("<p>Revenue increased <b>10%</b> year over year.</p>")).toContain(
      "Revenue increased 10% year over year.",
    );
  });

  it("removes script and style blocks entirely, including their content", () => {
    const result = stripHtmlToText(
      "<style>.foo{color:red}</style><script>alert(1)</script><p>Real content</p>",
    );
    expect(result).not.toContain("color:red");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Real content");
  });

  it("removes HTML comments", () => {
    expect(stripHtmlToText("<!-- internal note --><p>Visible text</p>")).not.toContain("internal note");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtmlToText("<p>Smith &amp; Co reported &lt;$1M&gt;</p>")).toContain(
      "Smith & Co reported <$1M>",
    );
  });

  it("converts block-level tags to line breaks so paragraphs stay separated", () => {
    const result = stripHtmlToText("<p>First paragraph</p><p>Second paragraph</p>");
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
    expect(result.indexOf("First paragraph")).toBeLessThan(result.indexOf("Second paragraph"));
  });

  it("collapses excessive whitespace", () => {
    const result = stripHtmlToText("<p>a</p>\n\n\n\n<p>b</p>");
    expect(result).not.toMatch(/\n{3,}/);
  });
});
