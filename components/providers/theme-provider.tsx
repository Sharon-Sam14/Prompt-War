"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Class-strategy theme provider (docs/Design.md §3): `next-themes` toggles the
 * `.dark` class on <html>, which our CSS variables in app/globals.css key off.
 * `attribute="class"` + no forced default means system preference wins until
 * the user chooses; `enableSystem` avoids a flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
