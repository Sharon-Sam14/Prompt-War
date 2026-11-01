import type { Vertical } from "@/lib/genai/schemas";

/**
 * Bundled photography for the three sanctioned slots (Design.md §4.6, D44):
 *   1. landing hero band — HERO_PHOTO (priority: it is the LCP element)
 *   2. setup masthead     — VERTICAL_PHOTOS[vertical] (swaps with the radios)
 *   3. overview header    — VERTICAL_PHOTOS[vertical] (md+ only)
 *
 * All four files are Pexels License (commercial use OK, no attribution
 * required — README credits the photo IDs anyway), downloaded once into
 * `public/images/photos/` and served locally (never hotlinked).
 * Keep every file ≤ 250 KB; intrinsic sizes declared here keep CLS at 0.
 */
export const HERO_PHOTO = {
  src: "/images/photos/hero-suite.jpg",
  width: 1600,
  height: 1067,
} as const;

export const VERTICAL_PHOTOS: Record<
  Vertical,
  { src: string; width: number; height: number; objectPosition?: string }
> = {
  wedding: { src: "/images/photos/wedding-table.jpg", width: 1100, height: 733 },
  // Portrait source in landscape mounts: bias the crop down so the whole
  // cake + stand stay inside the frame (verified against rendered plates).
  birthday: {
    src: "/images/photos/birthday-cake.jpg",
    width: 900,
    height: 1350,
    objectPosition: "50% 75%",
  },
  community: {
    src: "/images/photos/community-gathering.jpg",
    width: 1100,
    height: 733,
  },
};
