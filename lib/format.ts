/**
 * Presentation formatting shared by every planner surface (SSR + client must
 * produce identical strings, so no locale randomness: these use the page
 * locale resolved once by Intl defaults and pure math on integer cents).
 */

const CURRENCY_FALLBACK = "USD";

/** Integer cents → localized currency string. Cents are the only money unit. */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || CURRENCY_FALLBACK,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    // Unknown currency code from a hostile/legacy input: still show the number.
    return formatMoney(cents, CURRENCY_FALLBACK);
  }
}

/** "12,345" for counts (guests, totals) — tabular figures in the UI. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

/** ISO timestamp → medium date ("Jun 15, 2027"). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

/** ISO timestamp → date + time ("Jun 15, 2027, 3:04 PM"). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** Whole days from now until the event (min 0) + human label for chips. */
export function countdown(eventDateIso: string): { days: number; label: string } {
  const ms = new Date(eventDateIso).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  if (days === 0) return { days: 0, label: "Today" };
  if (days === 1) return { days: 1, label: "Tomorrow" };
  return { days, label: `In ${days} days` };
}

/** True when a deadline falls inside the next `windowDays` (overdue counts too). */
export function isDueWithin(dueDateIso: string, windowDays: number): boolean {
  return new Date(dueDateIso).getTime() - Date.now() <= windowDays * 86_400_000;
}

/**
 * User-typed money ("1,234.56" / "1234") → integer cents, or null when the
 * string is not a valid non-negative amount. Never throws, never floats out.
 */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Percentage of a part against whole, clamped to [0, 999] for bar widths. */
export function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(999, Math.max(0, (part / whole) * 100));
}
