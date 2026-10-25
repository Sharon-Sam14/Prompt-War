"use client";

import { ChevronDown, FileCheck2, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import { VendorDisclaimer } from "@/components/planner/vendor-disclaimer";
import { type ChecklistCategory, type VendorStatus } from "@/lib/genai/schemas";

/**
 * Vendor checklist (Phases.md 3.7): per-category groups of vendors with
 * inquiry questions (details/summary — keyboard-reachable disclosure), document
 * trackers, and a server-enum status selector. `itemKey` addresses an item by
 * its position (`categoryIndex:itemIndex`) so UI state never leaks into the
 * Zod-validated plan shape.
 */

const STATUS_META: Record<VendorStatus, { label: string; className: string }> = {
  to_contact: { label: "To contact", className: "bg-muted text-muted-foreground" },
  contacted: { label: "Contacted", className: "bg-accent-a/15 text-accent-a-text" },
  quoted: { label: "Quoted", className: "bg-accent-b/15 text-accent-b-text" },
  booked: { label: "Booked", className: "bg-success/15 text-success-text" },
};

const STATUSES = Object.keys(STATUS_META) as VendorStatus[];

export function VendorChecklist({ checklist }: { checklist: ChecklistCategory[] }) {
  const setItemStatus = usePlannerStore((s) => s.setItemStatus);
  const receivedDocs = usePlannerStore((s) => s.receivedDocs);
  const toggleDocReceived = usePlannerStore((s) => s.toggleDocReceived);

  // Accordion UI state (Design.md §4.3) — local only, never persisted.
  const [openCats, setOpenCats] = useState<Record<number, boolean>>({});
  const toggleCat = (idx: number) =>
    setOpenCats((prev) => ({ ...prev, [idx]: !(prev[idx] ?? true) }));

  const totalItems = checklist.reduce((n, c) => n + c.items.length, 0);
  const bookedItems = checklist.reduce(
    (n, c) => n + c.items.filter((item) => item.status === "booked").length,
    0,
  );

  return (
    <Reveal stagger={50} className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        {bookedItems} of {totalItems} vendors booked · inquiry questions and document trackers are
        engine-provided
      </p>

      {checklist.map((cat, catIdx) => {
        const open = openCats[catIdx] ?? true;
        return (
          <section key={cat.category} aria-labelledby={`cat-${catIdx}`} className="grid gap-3">
            <h3 id={`cat-${catIdx}`}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`cat-panel-${catIdx}`}
                onClick={() => toggleCat(catIdx)}
                className="flex w-full items-center gap-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                <span
                  aria-hidden="true"
                  className="display grid size-6 shrink-0 place-items-center rounded-full bg-accent-a/15 text-xs font-semibold text-accent-a-text"
                >
                  {catIdx + 1}
                </span>
                <span className="display text-base font-semibold">{cat.category}</span>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {cat.items.filter((i) => i.status === "booked").length}/{cat.items.length} booked
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            </h3>

            <div id={`cat-panel-${catIdx}`} hidden={!open}>
              <ul className="grid gap-2 rounded-md border border-border">
                {cat.items.map((item, itemIdx) => {
                  const itemKey = `${catIdx}:${itemIdx}`;
                  const docsReceived = receivedDocs[itemKey] ?? [];
                  return (
                    <li
                      key={item.id}
                      className="grid gap-2 border-b border-border p-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_META[item.status].className}>
                            {STATUS_META[item.status].label}
                          </Badge>
                          <Select
                            value={item.status}
                            onValueChange={(value) => setItemStatus(itemKey, value as VendorStatus)}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`Status for ${item.label}`}
                              className="h-7 w-32 text-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {item.questions.length > 0 && (
                        <details className="group/q text-xs">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-accent-a-text hover:underline">
                            <HelpCircle aria-hidden="true" className="size-3.5" />
                            <ChevronDown
                              aria-hidden="true"
                              className="size-3 transition-transform group-open/q:rotate-180"
                            />
                            {item.questions.length} question
                            {item.questions.length === 1 ? "" : "s"} to ask
                            <span className="sr-only"> (click to expand)</span>
                          </summary>
                          <ul className="mt-2 grid gap-1.5 border-l border-border pl-3 text-muted-foreground">
                            {item.questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {item.docs.length > 0 && (
                        <fieldset className="grid gap-1.5 border-t border-border pt-2">
                          <legend className="text-xs font-medium text-muted-foreground">
                            <FileCheck2 aria-hidden="true" className="mr-1 inline size-3" />
                            Documents to collect
                          </legend>
                          {item.docs.map((doc) => (
                            <Label
                              key={doc}
                              htmlFor={`doc-${itemKey}-${doc}`}
                              className="flex cursor-pointer items-center gap-2 text-xs"
                            >
                              <Checkbox
                                id={`doc-${itemKey}-${doc}`}
                                checked={docsReceived.includes(doc)}
                                onCheckedChange={() => toggleDocReceived(itemKey, doc)}
                              />
                              <span
                                className={
                                  docsReceived.includes(doc)
                                    ? "text-muted-foreground line-through"
                                    : ""
                                }
                              >
                                {doc}
                              </span>
                            </Label>
                          ))}
                        </fieldset>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
      <VendorDisclaimer />
    </Reveal>
  );
}
