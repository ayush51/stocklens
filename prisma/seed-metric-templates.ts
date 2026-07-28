import "dotenv/config"; // standalone entry point — Next.js loads .env itself, this script doesn't run through Next

import { prismaService as prisma } from "@/lib/db/prisma-service";

/**
 * Curated company-specific KPI templates — real reference content (like
 * Company rows), not throwaway demo data, so this is a separate one-off
 * loader rather than part of prisma/seed.ts's synthetic dev fixtures.
 * Idempotent (upserts throughout): safe to re-run after editing the lists
 * below to add/adjust metrics.
 *
 * The three example companies from docs' Phase 0 re-scope (ORCL/META/NVDA)
 * are also real positions in the seeded user's portfolio, so this is
 * immediately visible on already-held companies, not hypothetical.
 */

interface MetricSpec {
  key: string;
  label: string;
  description: string;
  unit: "USD" | "PERCENT" | "COUNT" | "TEXT";
}

interface TemplateItemSpec {
  metric: MetricSpec;
  whyItMatters: string;
  reportedIn: string;
}

// Shared across multiple companies' templates — one definition, reused.
const SHARED_METRICS = {
  capex: {
    key: "capital_expenditures",
    label: "Capital expenditures",
    description: "Cash spent on property, equipment, and infrastructure.",
    unit: "USD",
  },
  fcf: {
    key: "free_cash_flow",
    label: "Free cash flow",
    description: "Operating cash flow minus capital expenditures.",
    unit: "USD",
  },
  totalDebt: {
    key: "total_debt",
    label: "Total debt",
    description: "Sum of short- and long-term interest-bearing debt.",
    unit: "USD",
  },
  netDebt: {
    key: "net_debt",
    label: "Net debt",
    description: "Total debt minus cash and short-term investments.",
    unit: "USD",
  },
  interestExpense: {
    key: "interest_expense",
    label: "Interest expense",
    description: "Cost of servicing outstanding debt.",
    unit: "USD",
  },
  customerConcentration: {
    key: "customer_concentration",
    label: "Customer concentration",
    description: "Revenue share from the largest customer(s) — a dependency risk, not a growth metric.",
    unit: "TEXT",
  },
} satisfies Record<string, MetricSpec>;

const TEMPLATES: Record<string, { name: string; items: TemplateItemSpec[] }> = {
  ORCL: {
    name: "Oracle KPI template",
    items: [
      {
        metric: {
          key: "oci_revenue",
          label: "OCI revenue",
          description: "Oracle Cloud Infrastructure revenue.",
          unit: "USD",
        },
        whyItMatters: "The core growth engine the market is repricing Oracle around.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "oci_revenue_growth",
          label: "OCI revenue growth",
          description: "Year-over-year growth in OCI revenue.",
          unit: "PERCENT",
        },
        whyItMatters: "Whether the cloud infrastructure bet is actually accelerating or decelerating.",
        reportedIn: "10-Q / 10-K segment disclosures, earnings call",
      },
      {
        metric: {
          key: "cloud_revenue",
          label: "Cloud revenue",
          description: "Total cloud services and license support revenue.",
          unit: "USD",
        },
        whyItMatters: "The broader cloud transition, beyond OCI alone.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "cloud_revenue_growth",
          label: "Cloud revenue growth",
          description: "Year-over-year growth in total cloud revenue.",
          unit: "PERCENT",
        },
        whyItMatters: "Pace of the legacy-license-to-cloud transition.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "remaining_performance_obligations",
          label: "Remaining Performance Obligations (RPO)",
          description: "Contracted revenue not yet recognized.",
          unit: "USD",
        },
        whyItMatters: "A leading indicator of future cloud revenue — bookings ahead of recognition.",
        reportedIn: "10-Q / 10-K, earnings call",
      },
      {
        metric: {
          key: "rpo_growth",
          label: "RPO growth",
          description: "Year-over-year growth in RPO.",
          unit: "PERCENT",
        },
        whyItMatters: "Whether the demand pipeline is outpacing recognized revenue growth.",
        reportedIn: "10-Q / 10-K, earnings call",
      },
      {
        metric: SHARED_METRICS.capex,
        whyItMatters:
          "Oracle is spending heavily to build out cloud/AI data-center capacity — the bill for RPO growth.",
        reportedIn: "10-Q / 10-K cash flow statement",
      },
      {
        metric: SHARED_METRICS.fcf,
        whyItMatters: "Whether the capex buildout is being funded sustainably.",
        reportedIn: "10-Q / 10-K cash flow statement",
      },
      {
        metric: SHARED_METRICS.totalDebt,
        whyItMatters:
          "Oracle has historically run a leveraged balance sheet; debt load matters against capex plans.",
        reportedIn: "10-Q / 10-K balance sheet",
      },
      {
        metric: SHARED_METRICS.netDebt,
        whyItMatters: "Leverage net of cash on hand.",
        reportedIn: "10-Q / 10-K balance sheet",
      },
      {
        metric: SHARED_METRICS.interestExpense,
        whyItMatters: "Cost of the debt load, relevant given the capex-driven balance sheet.",
        reportedIn: "10-Q / 10-K income statement",
      },
      {
        metric: SHARED_METRICS.customerConcentration,
        whyItMatters: "Large individual cloud/AI contracts (single customers) can swing RPO materially.",
        reportedIn: "10-K risk factors, earnings call commentary",
      },
      {
        metric: {
          key: "data_center_capacity_commentary",
          label: "Data-centre capacity commentary",
          description: "Qualitative management commentary on capacity build-out and constraints.",
          unit: "TEXT",
        },
        whyItMatters: "Capacity constraints directly cap how fast RPO can convert to recognized revenue.",
        reportedIn: "Earnings call transcript",
      },
    ],
  },
  META: {
    name: "Meta KPI template",
    items: [
      {
        metric: {
          key: "advertising_revenue",
          label: "Advertising revenue",
          description: "Revenue from ads across the Family of Apps.",
          unit: "USD",
        },
        whyItMatters: "The overwhelming majority of Meta's revenue.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "advertising_revenue_growth",
          label: "Advertising revenue growth",
          description: "Year-over-year growth in advertising revenue.",
          unit: "PERCENT",
        },
        whyItMatters: "Core growth signal for the ads business.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "ad_impressions_growth",
          label: "Ad impressions (YoY growth)",
          description:
            "Year-over-year change in ad impressions delivered — Meta discloses this as a growth rate, not an absolute count.",
          unit: "PERCENT",
        },
        whyItMatters:
          "Splits ad-revenue growth into volume vs. price — are more ads being shown, or is each ad worth more?",
        reportedIn: "Earnings release, earnings call",
      },
      {
        metric: {
          key: "average_price_per_ad_growth",
          label: "Average price per ad (YoY growth)",
          description: "Year-over-year change in average price per ad.",
          unit: "PERCENT",
        },
        whyItMatters: "The pricing half of the ad-revenue growth decomposition.",
        reportedIn: "Earnings release, earnings call",
      },
      {
        metric: {
          key: "daily_active_people",
          label: "Daily Active People (DAP)",
          description: "Daily active people across the Family of Apps.",
          unit: "COUNT",
        },
        whyItMatters:
          "Engagement/reach across the whole app family, Meta's primary scale metric since retiring MAU/DAU by app.",
        reportedIn: "Earnings release",
      },
      {
        metric: {
          key: "family_average_revenue_per_person",
          label: "Family Average Revenue per Person",
          description: "Ad revenue divided by DAP.",
          unit: "USD",
        },
        whyItMatters: "Monetization efficiency per user, comparable across regions/quarters.",
        reportedIn: "Earnings release",
      },
      {
        metric: {
          key: "reality_labs_revenue",
          label: "Reality Labs revenue",
          description: "Revenue from the Reality Labs (AR/VR) segment.",
          unit: "USD",
        },
        whyItMatters: "Tracks whether the long-horizon hardware bet is gaining any commercial traction.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "reality_labs_operating_loss",
          label: "Reality Labs operating loss",
          description: "Operating loss from the Reality Labs segment.",
          unit: "USD",
        },
        whyItMatters: "The ongoing cost of the metaverse/AR bet, funded by the ads business.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: SHARED_METRICS.capex,
        whyItMatters:
          "AI/data-center infrastructure spend has become the dominant driver of Meta's capex and FCF trajectory.",
        reportedIn: "10-Q / 10-K cash flow statement, earnings call",
      },
      {
        metric: {
          key: "ai_infrastructure_guidance",
          label: "AI infrastructure guidance",
          description: "Forward-looking management commentary on AI/data-center capex plans.",
          unit: "TEXT",
        },
        whyItMatters:
          "Guidance changes here are one of the biggest swing factors in Meta's forward FCF and margin outlook.",
        reportedIn: "Earnings call transcript, guidance release",
      },
    ],
  },
  NVDA: {
    name: "Nvidia KPI template",
    items: [
      {
        metric: {
          key: "data_center_revenue",
          label: "Data Centre revenue",
          description: "Revenue from the Data Center segment (AI/HPC GPUs, networking).",
          unit: "USD",
        },
        whyItMatters: "The overwhelming majority of current revenue and the entire AI-buildout thesis.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "data_center_revenue_growth",
          label: "Data Centre revenue growth",
          description: "Year-over-year growth in Data Center segment revenue.",
          unit: "PERCENT",
        },
        whyItMatters: "Whether AI infrastructure demand is still accelerating.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "gaming_revenue",
          label: "Gaming revenue",
          description: "Revenue from the Gaming segment.",
          unit: "USD",
        },
        whyItMatters: "The original, now-secondary business — a check on diversification beyond Data Center.",
        reportedIn: "10-Q / 10-K segment disclosures",
      },
      {
        metric: {
          key: "gross_margin",
          label: "Gross margin",
          description: "Gross profit as a percentage of revenue.",
          unit: "PERCENT",
        },
        whyItMatters:
          "Pricing power signal — compresses if competition or customer concentration forces discounting.",
        reportedIn: "10-Q / 10-K income statement",
      },
      {
        metric: {
          key: "inventory",
          label: "Inventory",
          description: "Total inventory on the balance sheet.",
          unit: "USD",
        },
        whyItMatters:
          "A build-up can signal slowing demand or a supply-chain bet; a shortfall can signal a demand/supply mismatch.",
        reportedIn: "10-Q / 10-K balance sheet",
      },
      {
        metric: {
          key: "accounts_receivable",
          label: "Accounts receivable",
          description: "Amounts owed by customers, not yet collected.",
          unit: "USD",
        },
        whyItMatters:
          "A growing balance faster than revenue can indicate channel stuffing or customer credit risk.",
        reportedIn: "10-Q / 10-K balance sheet",
      },
      {
        metric: {
          key: "supply_commitments",
          label: "Supply commitments",
          description: "Disclosed purchase commitments with foundry/supply partners.",
          unit: "TEXT",
        },
        whyItMatters:
          "Nvidia's growth is currently supply-constrained — commitments signal capacity plans and risk.",
        reportedIn: "10-K commitments footnote",
      },
      {
        metric: SHARED_METRICS.customerConcentration,
        whyItMatters: "A handful of hyperscalers account for an outsized share of Data Center revenue.",
        reportedIn: "10-K risk factors",
      },
      {
        metric: {
          key: "geographic_restrictions",
          label: "Geographic restrictions",
          description: "Export-control/geographic restrictions affecting addressable market (e.g. China).",
          unit: "TEXT",
        },
        whyItMatters:
          "Regulatory export restrictions are a direct, disclosed cap on addressable Data Center revenue.",
        reportedIn: "10-K risk factors, earnings call",
      },
    ],
  },
};

async function main() {
  for (const [ticker, template] of Object.entries(TEMPLATES)) {
    const company = await prisma.company.findUnique({ where: { ticker } });
    if (!company) {
      console.warn(`Skipping ${ticker}: no Company row found — resolve it via the app first.`);
      continue;
    }

    const companyTemplate = await prisma.companyMetricTemplate.upsert({
      where: { companyId: company.id },
      update: { name: template.name },
      create: { companyId: company.id, name: template.name, source: "CURATED" },
    });

    let displayOrder = 0;
    for (const item of template.items) {
      const definition = await prisma.metricDefinition.upsert({
        where: { key: item.metric.key },
        update: { label: item.metric.label, description: item.metric.description, unit: item.metric.unit },
        create: item.metric,
      });

      await prisma.companyMetricTemplateItem.upsert({
        where: {
          templateId_metricDefinitionId: {
            templateId: companyTemplate.id,
            metricDefinitionId: definition.id,
          },
        },
        update: { whyItMatters: item.whyItMatters, reportedIn: item.reportedIn, displayOrder },
        create: {
          templateId: companyTemplate.id,
          metricDefinitionId: definition.id,
          whyItMatters: item.whyItMatters,
          reportedIn: item.reportedIn,
          displayOrder,
        },
      });
      displayOrder += 1;
    }

    console.log(`Seeded ${template.name}: ${template.items.length} metrics for ${ticker}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
