"use client";

import { AlertTriangle, CircleCheck, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeVariance } from "@/app/actions";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, parseMoneyToCents, pctOf } from "@/lib/format";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import { VendorDisclaimer } from "@/components/planner/vendor-disclaimer";
import type { BudgetCategory, ChecklistCategory } from "@/lib/genai/schemas";
import { vendorTotalForCategory } from "@/lib/store/use-planner-store";

/**
 * Budget table (Phases.md 3.5): editable planned/actual cells, per-row variance
 * bars, authoritative totals. The client shows optimistic numbers immediately;
 * each committed edit is re-checked by the server action (computeVariance) and
 * the server's total wins on disagreement — engine authority, UI convenience.
 */

interface BudgetTableProps {
  currency: string;
  totalCents: number;
  categories: BudgetCategory[];
  checklist: ChecklistCategory[];
  contingencyPct: number;
}

function VarianceBar({
  plannedShare,
  actualShare,
}: {
  plannedShare: number;
  actualShare: number | null;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent-a"
        style={{ width: `${Math.min(100, plannedShare)}%` }}
      />
      {actualShare !== null && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent-b"
          style={{ width: `${Math.min(100, actualShare)}%`, opacity: 0.85 }}
        />
      )}
    </div>
  );
}

/** Money cell: local draft text, commit on blur/Enter, revert on invalid input. */
function MoneyCell({
  value,
  currency,
  label,
  onCommit,
}: {
  value: number | null;
  currency: string;
  label: string;
  onCommit: (cents: number | null) => void;
}) {
  // `draft === null` means "not editing" — shown value tracks the prop directly,
  // so external store updates never need a state-sync effect.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : (value / 100).toFixed(2));
  const invalid = draft !== null && draft !== "" && parseMoneyToCents(draft) === null;

  function commit() {
    if (draft === null) return;
    const parsed = draft === "" ? null : parseMoneyToCents(draft);
    if (draft !== "" && parsed === null) {
      setDraft(null); // invalid text: cancel the edit, revert to committed value
      return;
    }
    onCommit(parsed);
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        aria-label={label}
        aria-invalid={invalid}
        inputMode="decimal"
        size={9}
        className="tnum h-7 px-2 text-right text-xs font-mono"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <span aria-hidden="true" className="text-xs text-muted-foreground">
        {currency}
      </span>
    </div>
  );
}

export function BudgetTable({
  currency,
  totalCents,
  categories,
  checklist,
  contingencyPct,
}: BudgetTableProps) {
  const editCategory = usePlannerStore((s) => s.editCategory);
  // Server variance for the exact categories snapshot it was computed from;
  // `null` until a confirmation for the *current* rows arrives.
  const [serverResult, setServerResult] = useState<{
    categories: BudgetCategory[];
    variance: number;
  } | null>(null);

  const localTotals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    let manual = 0;
    let vendors = 0;
    let hasActual = false;
    for (const c of categories) {
      planned += c.plannedCents;
      const vendorActual = vendorTotalForCategory(checklist, c.key);
      const manualActual =
        c.manualActualCents ??
        (c.actualCents === null ? null : Math.max(0, c.actualCents - vendorActual));
      if (manualActual !== null) manual += manualActual;
      vendors += vendorActual;
      if (c.actualCents !== null) {
        actual += c.actualCents;
        hasActual = true;
      }
    }
    return { planned, actual, manual, vendors, hasActual };
  }, [categories, checklist]);

  const varianceCents = localTotals.hasActual ? localTotals.actual - localTotals.planned : 0;
  const overBudget = varianceCents > 0;
  const underBudget = varianceCents < 0;

  // Authoritative confirmation after every committed edit (never per keystroke).
  useEffect(() => {
    if (!localTotals.hasActual) return;
    let cancelled = false;
    void computeVariance({ categories, contingencyPct }).then((result) => {
      if (!cancelled && result.ok) {
        setServerResult({ categories, variance: result.data });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [categories, contingencyPct, localTotals.hasActual]);

  const serverVariance =
    serverResult && serverResult.categories === categories ? serverResult.variance : null;

  // Server total wins if it disagrees with the optimistic local sum.
  const displayedVariance = serverVariance ?? varianceCents;
  const statusText =
    displayedVariance === 0
      ? "On budget"
      : overBudget
        ? `Over budget by ${formatMoney(Math.abs(displayedVariance), currency)}`
        : `Under budget by ${formatMoney(Math.abs(displayedVariance), currency)}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 font-medium ${
            overBudget ? "text-danger-text" : underBudget ? "text-success-text" : "text-foreground"
          }`}
        >
          {overBudget && <AlertTriangle aria-hidden="true" className="size-4" />}
          {underBudget && <CircleCheck aria-hidden="true" className="size-4" />}
          {statusText}
        </span>
        <span className="text-muted-foreground">
          Reserve {contingencyPct}% · Total {formatMoney(totalCents, currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          <PencilLine aria-hidden="true" className="mr-1 inline size-3" />
          Cells are editable; edits are verified by the server.
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Category</TableHead>
              <TableHead className="w-44 text-right">Planned</TableHead>
              <TableHead className="w-36 text-right">Manual actual</TableHead>
              <TableHead className="w-32 text-right">Vendor actual</TableHead>
              <TableHead className="w-36 text-right">Actual total</TableHead>
              <TableHead className="w-28 text-right">Variance</TableHead>
              <TableHead className="w-32">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => {
              const vendorActual = vendorTotalForCategory(checklist, c.key);
              const manualActual =
                c.manualActualCents ??
                (c.actualCents === null ? null : Math.max(0, c.actualCents - vendorActual));
              const variance = c.actualCents === null ? null : c.actualCents - c.plannedCents;
              return (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell>
                    <MoneyCell
                      value={c.plannedCents}
                      currency={currency}
                      label={`Planned amount for ${c.label}`}
                      onCommit={(cents) => {
                        if (cents !== null) editCategory(c.key, { plannedCents: cents });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <MoneyCell
                      value={manualActual}
                      currency={currency}
                      label={`Manual actual amount for ${c.label}`}
                      onCommit={(cents) => editCategory(c.key, { actualCents: cents })}
                    />
                  </TableCell>
                  <TableCell className="tnum text-right font-mono text-sm">
                    {vendorActual > 0 ? formatMoney(vendorActual, currency) : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right font-mono text-sm">
                    {c.actualCents === null ? "—" : formatMoney(c.actualCents, currency)}
                  </TableCell>
                  <TableCell className="tnum text-right font-mono text-sm">
                    {variance === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          variance > 0
                            ? "text-danger-text"
                            : variance < 0
                              ? "text-success-text"
                              : ""
                        }
                      >
                        {variance > 0 ? "+" : ""}
                        {formatMoney(variance, currency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <VarianceBar
                      plannedShare={pctOf(c.plannedCents, totalCents)}
                      actualShare={c.actualCents === null ? null : pctOf(c.actualCents, totalCents)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="tnum text-right font-mono font-semibold">
                {formatMoney(localTotals.planned, currency)}
              </TableCell>
              <TableCell className="tnum text-right font-mono font-semibold">
                {formatMoney(localTotals.manual, currency)}
              </TableCell>
              <TableCell className="tnum text-right font-mono font-semibold">
                {localTotals.vendors > 0 ? formatMoney(localTotals.vendors, currency) : "—"}
              </TableCell>
              <TableCell className="tnum text-right font-mono font-semibold">
                {localTotals.hasActual ? formatMoney(localTotals.actual, currency) : "—"}
              </TableCell>
              <TableCell
                colSpan={2}
                className={`tnum text-right font-mono font-semibold ${
                  overBudget ? "text-danger-text" : underBudget ? "text-success-text" : ""
                }`}
              >
                {localTotals.hasActual
                  ? `${displayedVariance > 0 ? "+" : ""}${formatMoney(displayedVariance, currency)}`
                  : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span>
            <span
              aria-hidden="true"
              className="mr-1 inline-block size-2 rounded-full bg-accent-a"
            />
            Planned share
          </span>
          <span>
            <span
              aria-hidden="true"
              className="mr-1 inline-block size-2 rounded-full bg-accent-b"
            />
            Actual share
          </span>
        </span>
      </p>
      <VendorDisclaimer />
    </div>
  );
}
