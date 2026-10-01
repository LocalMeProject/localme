"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered reveals for the marketing pages.
 *
 * Rather than wrapping every element in a component — which would change the
 * rendered markup and break list/grid semantics — each element opts in with
 * `data-reveal` plus an optional `--reveal-delay`, and this hook observes them
 * once on mount:
 *
 *   <article data-reveal style={revealDelay(index)}>…</article>
 *
 * The hidden start state is gated on `html.js` (set by the inline script in the
 * root layout), so the page is fully readable if JavaScript never runs.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (nodes.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((node) => {
        node.dataset.reveal = "in";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          observer.unobserve(entry.target);
        }
      },
      // Start the transition a little before the element is fully in view and
      // require a sliver of it to be visible, so fast scrolls still animate.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

/** Staggered `--reveal-delay` for a list of sibling reveals. */
export function revealDelay(index: number, step = 70, base = 0): React.CSSProperties {
  return { "--reveal-delay": `${base + index * step}ms` } as React.CSSProperties;
}