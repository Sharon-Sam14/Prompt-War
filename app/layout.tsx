import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Planner — GenAI celebration & event planning",
  description:
    "Plan weddings, birthdays and community events: AI-assisted ideas on top of a deterministic budget, timeline and vendor-checklist engine.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
      `dark` is hard-coded: the app is dark-only (owner direction 2026-10-27),
      so the very first server-rendered byte is already "aubergine & wine" —
      no light flash, and the UI stays dark even with JavaScript disabled.
      suppressHydrationWarning: next-themes' no-flash script also writes the
      class before React hydrates, so the server className may be touched.
    */
    <html lang="en" suppressHydrationWarning className="dark h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-card px-4 py-2 text-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
