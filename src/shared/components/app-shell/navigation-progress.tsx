"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Slim top-of-page progress bar for client navigations. Starts the moment an
 * internal link is clicked (before the next route has rendered anything, so
 * there is no dead time with no feedback) and finishes when the URL changes.
 */
function ProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const location = `${pathname}?${search}`;

  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(location);

  function clearTimers() {
    if (tick.current) clearInterval(tick.current);
    if (hide.current) clearTimeout(hide.current);
    if (failsafe.current) clearTimeout(failsafe.current);
    tick.current = hide.current = failsafe.current = null;
  }

  function finish() {
    clearTimers();
    setWidth(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
  }

  // The URL changed: the navigation this bar was tracking has landed.
  useEffect(() => {
    if (current.current !== location) {
      current.current = location;
      finish();
    }
    // finish only touches refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (`${url.pathname}?${url.searchParams.toString()}` === current.current) return;

      clearTimers();
      setVisible(true);
      setWidth(8);
      tick.current = setInterval(() => setWidth((w) => w + (90 - w) * 0.08), 200);
      failsafe.current = setTimeout(finish, 30_000);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // handlers only touch refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[100] h-0.5 w-full"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="bg-primary h-full shadow-[0_0_8px_var(--primary)]"
        style={{ width: `${width}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
