"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Dark-only theme provider (owner direction 2026-10-27: "remove the light mode
 * keep dark mode as default"). `next-themes` still supplies the `.dark` class on
 * <html> — that class is the single source of truth for the "aubergine & wine"
 * tokens in app/globals.css — but the theme is now pinned with `forcedTheme`,
 * so no Light/System state can ever win. The light `:root` palette stays in CSS
 * only because `tests/unit/theme-contrast.test.ts` verifies both palettes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
