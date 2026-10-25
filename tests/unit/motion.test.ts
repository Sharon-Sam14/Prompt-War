import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountUp } from "@/components/motion/count-up";
import {
  MAX_STAGGER_STEPS,
  MAX_STAGGER_TOTAL_MS,
  Reveal,
  planReveal,
} from "@/components/motion/reveal";
import { formatNumber } from "@/lib/format";

/**
 * Motion unit tests (PROMPT §1.7). The motion layer must degrade to *instant,
 * fully present content* whenever the user prefers reduced motion, and the
 * engine's final value must exist in the DOM for assistive tech regardless of
 * whether any animation ever runs. `planReveal` is the pure decision surface
 * that both `Reveal` and the reduced-motion wrapper consult, so it is asserted
 * directly instead of driving a real browser clock.
 */

describe("planReveal — reduced-motion contract", () => {
  it("never arms (instant content) when the user prefers reduced motion", () => {
    expect(planReveal({ reducedMotion: true, stagger: 60, childCount: 5 })).toEqual({
      arm: false,
      childDelays: [],
    });
  });

  it("never arms when stagger is disabled, even with motion allowed", () => {
    expect(planReveal({ reducedMotion: false, stagger: 0, childCount: 5 })).toEqual({
      arm: true,
      childDelays: [],
    });
  });

  it("arms with per-child delays when motion is allowed", () => {
    expect(planReveal({ reducedMotion: false, stagger: 60, childCount: 3 })).toEqual({
      arm: true,
      childDelays: [0, 60, 120],
    });
  });
});

describe("planReveal — stagger caps (no long waits, no layout shift)", () => {
  it("caps the number of distinct steps at MAX_STAGGER_STEPS", () => {
    const { childDelays } = planReveal({ reducedMotion: false, stagger: 10, childCount: 12 });
    expect(childDelays).toHaveLength(12);
    // Steps past the cap repeat the last step instead of growing linearly.
    expect(childDelays[MAX_STAGGER_STEPS]).toBe(MAX_STAGGER_STEPS * 10);
    expect(childDelays.at(-1)).toBe(MAX_STAGGER_STEPS * 10);
  });

  it("caps the total delay at MAX_STAGGER_TOTAL_MS", () => {
    const { childDelays } = planReveal({ reducedMotion: false, stagger: 100, childCount: 12 });
    expect(Math.max(...childDelays)).toBe(MAX_STAGGER_TOTAL_MS);
    for (let i = 1; i < childDelays.length; i += 1) {
      expect(childDelays[i]).toBeGreaterThanOrEqual(childDelays[i - 1]);
    }
  });
});

describe("CountUp — engine value is the DOM value", () => {
  it("server-renders the final engine value for AT and no-JS, with the digits hidden from AT", () => {
    const html = renderToStaticMarkup(createElement(CountUp, { to: 1234 }));
    const expected = formatNumber(1234);
    // Visible digits are aria-hidden; the sr-only twin carries the same string.
    expect(html).toContain(`aria-hidden="true">${expected}`);
    expect(html).toContain(`class="sr-only">${expected}`);
  });

  it("honours a display-only formatter without changing the underlying number", () => {
    const html = renderToStaticMarkup(
      createElement(CountUp, { to: 5000, format: (value: number) => `${Math.round(value)}%` }),
    );
    expect(html).toContain(">5000%</span>");
  });
});

describe("Reveal — content is never shipped hidden", () => {
  it("renders children with no arming classes in the server markup", () => {
    const html = renderToStaticMarkup(
      createElement(Reveal, { className: "grid" }, createElement("span", null, "Hello timeline")),
    );
    expect(html).toContain("Hello timeline");
    // Arming happens only in a layout effect after paint; SSR must never ship a
    // hidden state (guard against flash-of-hidden-content and AT blindness).
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("translate-y");
  });
});
