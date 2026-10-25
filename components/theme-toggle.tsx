"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Theme toggle (Design.md §5): icon-only control with an explicit accessible
 * name stating the action. Icon swap is pure CSS (.dark class from next-themes)
 * so SSR markup and client render always agree — no mounted-flag flash.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // onClick only fires client-side, where resolvedTheme is always defined.
  const next = (resolvedTheme ?? "light") === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      <Sun aria-hidden="true" className="size-4 dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-4 dark:block" />
    </Button>
  );
}
