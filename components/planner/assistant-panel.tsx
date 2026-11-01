"use client";

import { CircleHelp, MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildAskContext } from "@/lib/rules-engine/ask";
import { AskResponseSchema, type Plan } from "@/lib/genai/schemas";

/**
 * Conversational assistant panel (Design.md §4.9 / Phases 4.7) — Overview
 * section. Each turn POSTs the question plus a compact snapshot of THIS plan,
 * so the assistant follows up on the user's actual context. The thread is
 * session-only state: only the plan itself is ever persisted (no PII in
 * localStorage beyond plan data). Answers are announced via aria-live.
 */

interface Turn {
  id: number;
  question: string;
  answer: string;
  source: "engine" | "llm";
  followUp?: string;
}

const INITIAL_SUGGESTIONS = [
  "What's next?",
  "How much is catering?",
  "How many tasks are left?",
] as const;

export function AssistantPanel({ plan }: { plan: Plan }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([...INITIAL_SUGGESTIONS]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: turns
            .flatMap((turn) => [
              { role: "user" as const, text: turn.question },
              { role: "assistant" as const, text: turn.answer },
            ])
            .slice(-3),
          context: buildAskContext(plan),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { issues?: string } | null;
        throw new Error(body?.issues ?? `Question failed (${res.status})`);
      }
      const raw: unknown = await res.json();
      const parsed = AskResponseSchema.safeParse(raw);
      if (!parsed.success) throw new Error("Assistant returned an invalid response.");
      const data = parsed.data;
      setTurns((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          question: trimmed,
          answer: data.answer,
          source: data.source,
          followUp: data.followUp,
        },
      ]);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the assistant");
      setQuestion(trimmed); // keep the user's text so nothing is lost
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="ask-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="ask-title" className="eyebrow text-muted-foreground">
          <MessageCircleQuestion aria-hidden="true" className="mr-1.5 inline size-3.5" />
          Ask your planner
        </h3>
        <span className="text-xs text-muted-foreground">
          Each reply is labeled with its actual source: Model or Engine fallback.
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="ask-input" className="text-xs">
            Ask about this plan
          </Label>
          <Input
            id="ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How much is catering?"
            maxLength={500}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={busy || question.trim().length === 0}>
          <Send aria-hidden="true" className="size-3.5" />
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested questions">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => {
              setQuestion(s);
              void ask(s);
            }}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-gilt hover:text-gilt-text focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger-text">
          {error}
        </p>
      )}

      {turns.length > 0 && (
        <ul aria-live="polite" className="grid gap-3 border-t border-border pt-3">
          {turns.map((turn) => (
            <li key={turn.id} className="grid gap-1.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <CircleHelp aria-hidden="true" className="size-3.5 text-gilt-text" />
                {turn.question}
              </p>
              <p className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${
                    turn.source === "llm"
                      ? "border-accent-a bg-accent-a/15 text-accent-a-text"
                      : "text-muted-foreground"
                  }`}
                >
                  {turn.source === "llm" ? "Model" : "Engine"}
                </Badge>
                <span>
                  {turn.answer}
                  {turn.followUp && <span className="mt-1 block">{turn.followUp}</span>}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
