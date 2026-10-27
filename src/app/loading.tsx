import { LoadingNotice } from "@/shared/components/loading-notice";

/**
 * Covers the gap on a fresh page load while the signed-in layout resolves
 * the session and workspace, before any page-level skeleton can render.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <LoadingNotice>Loading StockLens…</LoadingNotice>
    </div>
  );
}
