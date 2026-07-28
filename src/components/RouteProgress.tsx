"use client";

import { useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";

// Configure NProgress
NProgress.configure({ showSpinner: false, trickleSpeed: 200, minimum: 0.08 });

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stop = useCallback(() => {
    NProgress.done();
  }, []);

  // Complete bar on every route change
  useEffect(() => {
    stop();
  }, [pathname, searchParams, stop]);

  // Intercept all <a> clicks to start the bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank"
      ) return;
      // Only internal links
      if (href.startsWith("/") || href.startsWith(window.location.origin)) {
        NProgress.start();
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <style>{`
      #nprogress {
        pointer-events: none;
      }
      #nprogress .bar {
        background: linear-gradient(90deg, #ec4899, #f472b6, #ec4899);
        background-size: 200% 100%;
        animation: pq-progress-shimmer 1.2s linear infinite;
        position: fixed;
        z-index: 9999;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        border-radius: 0 2px 2px 0;
        box-shadow: 0 0 8px rgba(236,72,153,0.6), 0 0 2px rgba(236,72,153,0.4);
      }
      #nprogress .peg {
        display: block;
        position: absolute;
        right: 0px;
        width: 100px;
        height: 100%;
        box-shadow: 0 0 10px #ec4899, 0 0 5px #ec4899;
        opacity: 1;
        transform: rotate(3deg) translate(0px, -4px);
      }
      @keyframes pq-progress-shimmer {
        0%   { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
    `}</style>
  );
}
