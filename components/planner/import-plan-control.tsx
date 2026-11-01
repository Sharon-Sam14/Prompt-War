"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanSchema } from "@/lib/genai/schemas";
import { usePlannerStore } from "@/lib/store/use-planner-store";

const MAX_IMPORT_BYTES = 2_000_000;

/**
 * Import only complete plans that pass the same Zod contract as API output.
 * `compact` renders the command-center toolbar variant (label/help visually
 * hidden, same accessible wiring) instead of the empty-state block.
 */
export function ImportPlanControl({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const importPlan = usePlannerStore((state) => state.importPlan);
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function readFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage("That file is too large. Choose a plan under 2 MB.");
      return;
    }
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = PlanSchema.safeParse(raw);
      if (!parsed.success) {
        setMessage("This file is not a valid event plan JSON.");
        return;
      }
      importPlan(parsed.data);
      router.push(`/plan/${parsed.data.id}`);
      setMessage("Plan imported on this device.");
    } catch {
      setMessage("Could not read that file. Choose a valid plan JSON export.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "contents" : "grid justify-items-start gap-2"}>
      <label htmlFor="plan-json-import" className={compact ? "sr-only" : "text-sm font-medium"}>
        Import plan (JSON)
      </label>
      <p
        id="plan-json-import-help"
        className={compact ? "sr-only" : "text-xs text-muted-foreground"}
      >
        Load a validated plan export under 2 MB into this browser.
      </p>
      <input
        ref={inputRef}
        id="plan-json-import"
        type="file"
        accept="application/json,.json"
        aria-describedby="plan-json-import-help plan-json-import-status"
        className="sr-only"
        onChange={(event) => void readFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant={compact ? "outline" : "secondary"}
        size={compact ? "sm" : "default"}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" className="size-3.5" />
        {compact ? "Import" : "Choose JSON file"}
      </Button>
      <p
        id="plan-json-import-status"
        role="status"
        aria-live="polite"
        className={compact ? "sr-only" : "text-xs text-muted-foreground"}
      >
        {message}
      </p>
    </div>
  );
}
