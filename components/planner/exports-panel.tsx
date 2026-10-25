"use client";

import { useState } from "react";
import { FileDown, FileJson, FileText, Printer, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportPlanControl } from "@/components/planner/import-plan-control";
import { VendorDisclaimer } from "@/components/planner/vendor-disclaimer";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Plan } from "@/lib/genai/schemas";

/**
 * Exports panel (Phases.md 4.1 / Design.md §4.7). All renderers read from the
 * client store — screen ≡ export by construction (D5). PDF (jsPDF) and CSV
 * (@json2csv/plainjs, the maintained json2csv successor) are lazily import()ed
 * inside the click handler so they never enter the initial page bundle.
 */

type ExportKind = "pdf" | "csv" | "md" | "json" | "print";

interface ExportRow {
  section: string;
  item: string;
  planned: string;
  actual: string;
  variance: string;
  date: string;
  status: string;
}

function slugify(plan: Plan): string {
  const date = plan.input.eventDate.slice(0, 10);
  const theme = plan.input.theme
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [plan.input.vertical, theme, date].filter(Boolean).join("-");
}

function collectRows(plan: Plan): ExportRow[] {
  const currency = plan.input.currency;
  const rows: ExportRow[] = plan.budget.categories.map((c) => {
    const variance = c.actualCents === null ? null : c.actualCents - c.plannedCents;
    return {
      section: "Budget",
      item: c.label,
      planned: (c.plannedCents / 100).toFixed(2),
      actual: c.actualCents === null ? "" : (c.actualCents / 100).toFixed(2),
      variance: variance === null ? "" : (variance / 100).toFixed(2),
      date: "",
      status: "",
    };
  });
  rows.push({
    section: "Budget",
    item: `Total (${currency})`,
    planned: (plan.input.budgetTotalCents / 100).toFixed(2),
    actual: "",
    variance: "",
    date: "",
    status: `reserve ${plan.budget.contingencyPct}%`,
  });
  for (const task of plan.timeline) {
    rows.push({
      section: "Timeline",
      item: task.title,
      planned: "",
      actual: "",
      variance: "",
      date: task.dueDate.slice(0, 10),
      status: `${task.phase} · ${task.done ? "done" : "open"} · T−${task.offsetDays}d`,
    });
  }
  for (const cat of plan.checklist) {
    for (const item of cat.items) {
      rows.push({
        section: "Checklist",
        item: `${cat.category} — ${item.label}`,
        planned: "",
        actual: "",
        variance: "",
        date: "",
        status: item.status.replace("_", " "),
      });
    }
  }
  return rows;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toMarkdown(plan: Plan): string {
  const lines: Array<string | null> = [];
  const heading = plan.input.theme
    ? `${plan.input.theme} — ${plan.input.vertical} plan`
    : `${plan.input.vertical} event plan`;
  lines.push(`# ${heading}`, "");
  lines.push(
    `- **Date:** ${formatDate(plan.input.eventDate)}`,
    `- **Guests:** ${plan.input.guestCount.toLocaleString()}`,
    plan.input.location ? `- **Location:** ${plan.input.location}` : null,
    `- **Budget:** ${formatMoney(plan.input.budgetTotalCents, plan.input.currency)} (${plan.input.budgetBand} band, reserve ${plan.budget.contingencyPct}%)`,
    `- **Generated:** ${formatDateTime(plan.meta.generatedAt)} · source: ${plan.meta.source}${plan.meta.cacheHit ? " (cache)" : ""}`,
    "",
  );
  lines.push("## Budget", "", "| Category | Planned | Actual | Variance |", "|---|---:|---:|---:|");
  for (const c of plan.budget.categories) {
    const actual = c.actualCents === null ? "—" : formatMoney(c.actualCents, plan.input.currency);
    const variance =
      c.actualCents === null
        ? "—"
        : formatMoney(c.actualCents - c.plannedCents, plan.input.currency);
    lines.push(
      `| ${c.label} | ${formatMoney(c.plannedCents, plan.input.currency)} | ${actual} | ${variance} |`,
    );
  }
  lines.push("", "## Timeline", "");
  for (const t of plan.timeline) {
    lines.push(
      `- [${t.done ? "x" : " "}] ${t.title} — ${formatDate(t.dueDate)} (T−${t.offsetDays}d, ${t.phase})`,
    );
  }
  lines.push("", "## Vendor checklist", "");
  for (const cat of plan.checklist) {
    lines.push(`### ${cat.category}`);
    for (const item of cat.items) {
      lines.push(
        `- [${item.status === "booked" ? "x" : " "}] ${item.label} — ${item.status.replace("_", " ")}`,
      );
    }
    lines.push("");
  }
  if (plan.ideas.length > 0) {
    lines.push("## Ideas", "");
    for (const idea of plan.ideas) {
      lines.push(`- **${idea.title}** — ${idea.rationale}`);
    }
    lines.push("");
  }
  return lines.filter((l) => l !== null).join("\n");
}

async function exportPdf(plan: Plan) {
  const { jsPDF } = await import("jspdf");
  // White document canvas — fixed print colors, independent of the screen theme.
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const LEFT = 56;
  const RIGHT = 539;
  let y = 76;
  const ensure = (need: number) => {
    if (y + need > 790) {
      doc.addPage();
      y = 76;
    }
  };

  const heading = plan.input.theme
    ? `${plan.input.theme} — ${plan.input.vertical} plan`
    : `${plan.input.vertical} event plan`;
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(heading, LEFT, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    formatDate(plan.input.eventDate),
    `${plan.input.guestCount.toLocaleString()} guests`,
    plan.input.location,
    formatMoney(plan.input.budgetTotalCents, plan.input.currency),
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(meta, LEFT, y);
  y += 14;
  doc.setTextColor(102, 95, 82); // muted paper text
  doc.text(
    `Generated ${formatDateTime(plan.meta.generatedAt)} · ${plan.meta.source} mode`,
    LEFT,
    y,
  );
  doc.setTextColor(0, 0, 0);
  y += 14;
  doc.setDrawColor(168, 128, 42); // #A8802A gilt rule — document canvas, not screen UI
  doc.setLineWidth(1);
  doc.line(LEFT, y, RIGHT, y);
  y += 28;

  // Budget ledger
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Budget", LEFT, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CATEGORY", LEFT, y);
  doc.text("PLANNED", 340, y, { align: "right" });
  doc.text("ACTUAL", 440, y, { align: "right" });
  doc.text("VARIANCE", RIGHT, y, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const c of plan.budget.categories) {
    ensure(16);
    const variance = c.actualCents === null ? null : c.actualCents - c.plannedCents;
    doc.text(c.label, LEFT, y);
    doc.text(formatMoney(c.plannedCents, plan.input.currency), 340, y, { align: "right" });
    doc.text(
      c.actualCents === null ? "—" : formatMoney(c.actualCents, plan.input.currency),
      440,
      y,
      { align: "right" },
    );
    doc.text(variance === null ? "—" : formatMoney(variance, plan.input.currency), RIGHT, y, {
      align: "right",
    });
    y += 15;
  }
  ensure(34);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Total", LEFT, y);
  doc.text(formatMoney(plan.input.budgetTotalCents, plan.input.currency), 340, y, {
    align: "right",
  });
  doc.text(`reserve ${plan.budget.contingencyPct}%`, RIGHT, y, { align: "right" });
  y += 30;

  // Reverse timeline
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Timeline", LEFT, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const t of plan.timeline) {
    ensure(16);
    const mark = t.done ? "[x]" : "[ ]";
    doc.text(`${mark} ${t.title}`, LEFT, y);
    doc.text(`${formatDate(t.dueDate)}  T-${t.offsetDays}d`, RIGHT, y, { align: "right" });
    y += 15;
  }
  y += 16;

  // Vendor checklist
  ensure(40);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Vendor checklist", LEFT, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const cat of plan.checklist) {
    ensure(20);
    doc.setFont("helvetica", "bold");
    doc.text(cat.category, LEFT, y);
    doc.setFont("helvetica", "normal");
    y += 15;
    for (const item of cat.items) {
      ensure(15);
      doc.text(`   ${item.label} — ${item.status.replace("_", " ")}`, LEFT, y);
      y += 14;
    }
    y += 6;
  }

  doc.save(`${slugify(plan)}.pdf`);
}

async function exportCsv(plan: Plan) {
  const { Parser } = await import("@json2csv/plainjs");
  const parser = new Parser({
    fields: [
      { label: "Section", value: "section" },
      { label: "Item", value: "item" },
      { label: "Planned", value: "planned" },
      { label: "Actual", value: "actual" },
      { label: "Variance", value: "variance" },
      { label: "Date", value: "date" },
      { label: "Status", value: "status" },
    ],
  });
  download(parser.parse(collectRows(plan)), `${slugify(plan)}.csv`, "text/csv;charset=utf-8");
}

const FORMAT_META: ReadonlyArray<{
  kind: Exclude<ExportKind, "print">;
  title: string;
  icon: React.ElementType;
  body: string;
  cta: string;
}> = [
  {
    kind: "pdf",
    title: "PDF",
    icon: FileDown,
    body: "Editorial full-plan document — serif headings, ledger, timeline and checklist.",
    cta: "Download PDF",
  },
  {
    kind: "csv",
    title: "CSV",
    icon: Table,
    body: "Budget, timeline and checklist rows — one table, ready for any spreadsheet.",
    cta: "Download CSV",
  },
  {
    kind: "md",
    title: "Markdown",
    icon: FileText,
    body: "Plain-text plan with checkboxes for notes apps, docs and issue trackers.",
    cta: "Download Markdown",
  },
  {
    kind: "json",
    title: "JSON",
    icon: FileJson,
    body: "Complete plan backup with validated input, budget, tasks, vendors and ideas.",
    cta: "Download JSON",
  },
];

export function ExportsPanel({ plan }: { plan: Plan }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const slug = slugify(plan);

  async function run(kind: ExportKind) {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "pdf") await exportPdf(plan);
      else if (kind === "csv") await exportCsv(plan);
      else if (kind === "md")
        download(toMarkdown(plan), `${slug}.md`, "text/markdown;charset=utf-8");
      else if (kind === "json")
        download(JSON.stringify(plan, null, 2), `${slug}.json`, "application/json;charset=utf-8");
      else {
        window.print();
        setMessage({
          kind: "ok",
          text: "Opened the print dialog — chrome is hidden in print output.",
        });
        return;
      }
      const ext = kind === "md" ? "md" : kind;
      setMessage({
        kind: "ok",
        text: `Exported ${slug}.${ext} — contents match what's on screen.`,
      });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="max-w-[72ch] text-sm text-muted-foreground">
        Exports read directly from your open plan — the file always matches the screen. Renderers
        load on click, so the rest of the app stays lean.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FORMAT_META.map((fmt) => (
          <li key={fmt.kind} className="grid gap-2 rounded-lg border border-border bg-card p-4">
            <fmt.icon aria-hidden="true" className="size-4 text-accent-a-text" />
            <h3 className="display text-base font-semibold">{fmt.title}</h3>
            <p className="text-xs text-muted-foreground">{fmt.body}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="justify-self-start"
              disabled={busy !== null}
              onClick={() => void run(fmt.kind)}
            >
              {busy === fmt.kind ? "Preparing…" : fmt.cta}
            </Button>
          </li>
        ))}
        <li className="grid gap-2 rounded-lg border border-border bg-card p-4">
          <Printer aria-hidden="true" className="size-4 text-accent-a-text" />
          <h3 className="display text-base font-semibold">Print</h3>
          <p className="text-xs text-muted-foreground">
            Stationery output — header and rail are hidden, paper stays clean.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="justify-self-start"
            disabled={busy !== null}
            onClick={() => void run("print")}
          >
            Print this tab
          </Button>
        </li>
      </ul>

      <div className="rounded-lg border border-border bg-card p-4">
        <ImportPlanControl />
      </div>
      <VendorDisclaimer />

      <p role="status" aria-live="polite" className="min-h-4 text-xs">
        <span className={message?.kind === "error" ? "text-danger-text" : "text-success-text"}>
          {message?.text ?? ""}
        </span>
      </p>
    </div>
  );
}
