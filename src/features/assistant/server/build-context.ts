import { forUser } from "@/lib/db/rls";
import { getPortfoliosForUser } from "@/features/portfolios/server/queries";

/**
 * Assembles the real, DB-sourced grounding data the chat assistant reasons
 * over — the same holdings data shown on /portfolios, plus each company's
 * thesis status if one exists. Compact on purpose: this is rebuilt and
 * sent on every turn (see assistant/server/actions.ts), so it stays a
 * summary table rather than every thesis field or per-company filing text.
 */
export async function buildPortfolioContext(userId: string): Promise<string> {
  const portfolios = await getPortfoliosForUser(userId);
  const allHoldings = portfolios.flatMap((p) => [...p.stocks, ...p.etfs]);

  if (allHoldings.length === 0) {
    return "The user has no holdings recorded yet.";
  }

  const theses = await forUser(userId).thesis.findMany({
    where: { companyId: { in: allHoldings.map((h) => h.companyId) } },
    select: { companyId: true, title: true, status: true, conviction: true, targetPrice: true },
  });
  const thesisByCompany = new Map(theses.map((t) => [t.companyId, t]));

  const holdingLines = allHoldings.map((h) => {
    const thesis = thesisByCompany.get(h.companyId);
    const thesisNote = thesis
      ? ` | thesis: "${thesis.title || "untitled"}" status=${thesis.status} conviction=${thesis.conviction}${thesis.targetPrice ? ` targetPrice=$${thesis.targetPrice}` : ""}`
      : " | no thesis recorded";
    return `- ${h.ticker} (${h.name}): qty=${h.quantity}, avgCost=$${h.averageCost}, price=${h.price ? `$${h.price}` : "unavailable"}, marketValue=${h.marketValue ? `$${h.marketValue}` : "unavailable (using cost basis)"}, unrealizedG/L=${h.unrealizedGainLossPct ? `${h.unrealizedGainLossPct}%` : "unknown"}, allocation=${h.allocationPct}%${h.isOverConcentrationThreshold ? " [OVER CONCENTRATION THRESHOLD]" : ""}${thesisNote}`;
  });

  return `Current holdings (${allHoldings.length} positions):\n${holdingLines.join("\n")}`;
}
