"use client";

import { useEffect, useLayoutEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Reveal — the project's own entry/reveal primitive (Design.md §1.7, Memory.md D34).
 *
 * React Bits' GSAP-based reveals (`FadeContent`, `SplitText`, `AnimatedContent`)
 * were measured and rejected: `gsap` core is 27.8 KB gzip and `ScrollTrigger`
 * another 17.6 KB gzip, which alone exceeds the 30 KB motion budget. The prompt's
 * escape hatch applies — "drop components, not accessibility" — so this 0 KB
 * dependency version keeps the same behaviour: opacity plus a small translate,
 * 400 ms ease-out, once, and instantly visible under `prefers-reduced-motion`
 * (checked in CSS *and* JS).
 *
 * The DOM shape never changes (no extra wrappers): the animation is applied to
 * the element the caller renders and, in `stagger` mode, to its direct children
 * through `transition-delay` only — so landmarks, roving tabindex, focus order
 * and assistive-tech text are untouched.
 */

export const REVEAL_DURATION_MS = 400;
/** Stagger steps are capped so a long list never waits on its own animation. */
export const MAX_STAGGER_STEPS = 6;
export const MAX_STAGGER_TOTAL_MS = 240;
/** Safety net: content is never left hidden, whatever the observer does. */
const REVEAL_FALLBACK_MS = 1200;

const SELF_ARMED = ["opacity-0", "translate-y-2"];
const SELF_REVEALED = [
  "opacity-100",
  "translate-y-0",
  "transition-[opacity,translate,transform]",
  "duration-[400ms]",
  "ease-out",
];
const CHILD_ARMED = ["opacity-0", "translate-y-1.5"];
const CHILD_REVEALED = [
  "opacity-100",
  "translate-y-0",
  "transition-[opacity,translate,transform]",
  "duration-[400ms]",
  "ease-out",
];

export interface RevealPlan {
  /** When false nothing is hidden: the content renders instantly, already visible. */
  arm: boolean;
  /** Per-child transition delays in ms; empty when the container itself animates. */
  childDelays: number[];
}

/**
 * Pure decision surface for the reveal, unit-tested without a DOM
 * (`tests/unit/motion.test.ts`). Reduced motion always means "instant content".
 */
export function planReveal({
  reducedMotion,
  stagger,
  childCount,
}: {
  reducedMotion: boolean;
  stagger: number;
  childCount: number;
}): RevealPlan {
  if (reducedMotion || stagger <= 0) {
    return { arm: !reducedMotion, childDelays: [] };
  }
  return {
    arm: true,
    childDelays: Array.from(
      { length: childCount },
      (_, index) => Math.min(index, MAX_STAGGER_STEPS) * stagger,
    ).map((delay) => Math.min(delay, MAX_STAGGER_TOTAL_MS)),
  };
}

/** `useLayoutEffect` warns during SSR; client components are still server-rendered. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export type RevealProps = {
  children?: ReactNode;
  /** Rendered element — keeps the caller's semantics (h2, ol, section…). */
  as?: ElementType;
  className?: string;
  /** ms between the direct children; 0 animates the element itself. */
  stagger?: number;
  /** `view` reveals on scroll into view, `mount` reveals immediately. */
  trigger?: "view" | "mount";
} & Omit<React.ComponentPropsWithoutRef<"div">, "children" | "className" | "ref">;

export function Reveal({
  children,
  as: Tag = "div",
  className,
  stagger = 0,
  trigger = "view",
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const staggered = stagger > 0 ? (Array.from(el.children) as HTMLElement[]) : [];
    const { arm, childDelays } = planReveal({
      reducedMotion: prefersReducedMotion(),
      stagger,
      childCount: staggered.length,
    });
    if (!arm) return undefined;

    const targets = staggered.length ? staggered : [el];
    const armedClasses = staggered.length ? CHILD_ARMED : SELF_ARMED;
    const revealedClasses = staggered.length ? CHILD_REVEALED : SELF_REVEALED;

    targets.forEach((target, index) => {
      const delay = childDelays[index] ?? 0;
      if (delay) target.style.transitionDelay = `${delay}ms`;
      target.classList.add(...armedClasses);
    });

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      targets.forEach((target) => {
        target.classList.remove(...armedClasses);
        target.classList.add(...revealedClasses);
      });
    };

    const timer = window.setTimeout(show, REVEAL_FALLBACK_MS);
    let observer: IntersectionObserver | undefined;
    let frame = 0;

    if (trigger === "mount" || typeof IntersectionObserver === "undefined") {
      frame = window.requestAnimationFrame(show);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          observer?.disconnect();
          show();
        },
        { threshold: 0.15, rootMargin: "0px 0px -5% 0px" },
      );
      observer.observe(el);
    }

    return () => {
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      // Unmounting mid-animation must not strand a hidden child.
      targets.forEach((target) => target.classList.remove(...armedClasses));
    };
  }, [stagger, trigger]);

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
