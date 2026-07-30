import type { NextConfig } from "next";

/**
 * instructions.md §3 "Security before convenience" — this app had zero HTTP
 * security headers configured. The CSP ships as Report-Only rather than
 * enforced: this app's client bundle (recharts, shadcn, the chat widget,
 * Supabase browser auth) hasn't been verified against a strict CSP in an
 * actual browser — no browser-automation tool is available in this
 * environment to confirm nothing breaks. Report-Only has zero risk of
 * breaking real functionality (it only logs violations to the browser
 * console, never blocks a request) and gives real signal on what a safe
 * enforced policy would need to allow before flipping CONTENT_SECURITY_POLICY_HEADER
 * to the enforcing header name.
 *
 * Only Supabase needs an explicit connect-src allowance — every other
 * external API (Finnhub, SEC EDGAR, Yahoo, Gemini) is called server-side,
 * never directly from the browser, so the page's own CSP doesn't apply to
 * those requests at all.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
