"use client";

import { animate } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";

/**
 * CountUp — adopted from React Bits (`npx shadcn@latest add @react-bits/CountUp-TS-TW`),
 * which declares `motion` as its only dependency. Adapted as owned code
 * (Design.md §1.7, Memory.md D34):
 *
 * - Stripped: the `roll`/slot-machine mode, the SVG Gaussian-blur filters, hover
 *   replay, compact units, `separator`/`prefix`/`suffix`/`direction` and the
 *   unused callbacks. What remains is the plain count the dashboard needs.
 * - No hardcoded hex, gradients, glow or blur (Design.md §1.1 applies to motion).
 * - Accessibility: the animated digits are `aria-hidden`; a visually hidden
 *   sibling carries the engine's exact final value, so assistive tech never
 *   reads an intermediate frame.
 * - Money and counts stay integers in cents/units from the engine; the optional
 *   `format` callback only changes the display string, never the number.
 * - Animates once, on first mount and only when in view. Later value changes
 *   (re-edits) snap instantly. Reduced motion renders the final value.
 */

export interface CountUpProps {
  /** Final value from the deterministic engine. */
  to: number;
  from?: number;
  /** Milliseconds; keep within the 200–500 ms budget of Design.md §1.7. */
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Display-only formatter (e.g. `Intl` money from integer cents). */
  format?: (value: number) => string;
}

const defaultFormat = (value: number) => formatNumber(Math.round(value));

/** `useLayoutEffect` warns during SSR; client components are still server-rendered. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function CountUp({
  to,
  from = 0,
  duration = 420,
  delay = 0,
  className,
  style,
  format,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  // Latest props for the animation loop without re-subscribing on every render.
  const live = useRef({ format, duration, delay });
  const formatValue = useCallback(
    (value: number) => (live.current.format ?? defaultFormat)(value),
    [],
  );

  useIsoLayoutEffect(() => {
    live.current = { format, duration, delay };
  });

  /**
   * One effect for both concerns, so they can never fight each other:
   * first mount starts the count (when motion is allowed), every other render
   * snaps to the current engine value.
   */
  useIsoLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return undefined;

    const firstMount = !mountedRef.current;
    mountedRef.current = true;
    const { duration: ms, delay: wait } = live.current;

    if (!firstMount || prefersReducedMotion() || ms <= 0) {
      node.textContent = formatValue(to);
      return undefined;
    }

    node.textContent = formatValue(from);
    let controls: { stop: () => void } | undefined;
    const start = () => {
      runningRef.current = true;
      controls = animate(from, to, {
        duration: ms / 1000,
        delay: wait / 1000,
        ease: "easeOut",
        onUpdate: (value) => {
          node.textContent = formatValue(value);
        },
        onComplete: () => {
          runningRef.current = false;
          node.textContent = formatValue(to);
        },
      });
    };

    const host = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        start();
      },
      { threshold: 0.4 },
    );
    if (host) observer.observe(host);
    else start();

    return () => {
      observer.disconnect();
      controls?.stop();
      runningRef.current = false;
    };
  }, [from, to, formatValue]);

  // Rendered (and server-rendered) text is the engine's final value; the effect
  // above only rewrites it imperatively while the count is running.
  const finalText = (format ?? defaultFormat)(to);

  return (
    <span ref={ref} className={className} style={style}>
      <span ref={textRef} aria-hidden="true">
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
