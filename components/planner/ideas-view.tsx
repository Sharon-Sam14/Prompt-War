"use client";

import Image from "next/image";
import { Bookmark, BookmarkCheck, Check, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Idea } from "@/lib/genai/schemas";
import { usePlannerStore } from "@/lib/store/use-planner-store";

/**
 * Personalized ideas view with tag filters and a visible provenance badge for
 * every deterministic or model-enriched recommendation.
 */
export function IdeasView({ ideas }: { ideas: Idea[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const savedIdeaIds = usePlannerStore((state) => state.savedIdeaIds);
  const appliedIdeaIds = usePlannerStore((state) => state.appliedIdeaIds);
  const toggleSavedIdea = usePlannerStore((state) => state.toggleSavedIdea);
  const applyIdea = usePlannerStore((state) => state.applyIdea);

  const allTags = useMemo(() => [...new Set(ideas.flatMap((i) => i.tags))].sort(), [ideas]);
  const shown = useMemo(
    () => (activeTag === null ? ideas : ideas.filter((i) => i.tags.includes(activeTag))),
    [ideas, activeTag],
  );
  if (ideas.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center">
        <Image
          src="/images/empty-ideas.svg"
          alt=""
          aria-hidden="true"
          width={240}
          height={160}
          unoptimized
          className="h-28 w-auto"
        />
        <p className="display text-base font-semibold">No personalized ideas in this plan</p>
        <p className="max-w-[46ch] text-xs text-muted-foreground">
          Your plan is complete. New rule-based and model-enriched ideas will appear here when
          available.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {activeTag === null
          ? `${ideas.length} personalized idea${ideas.length === 1 ? "" : "s"} generated for your inputs`
          : `Showing ${shown.length} of ${ideas.length} ideas in “${activeTag}”`}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {feedback}
      </p>

      {/* Tag filters (Design.md §4.8) — client-only state */}
      {allTags.length > 0 && (
        <div role="group" aria-label="Filter ideas by category" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={activeTag === null}
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-2.5 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring/70 ${
              activeTag === null
                ? "border-accent-a bg-accent-a/15 font-medium text-accent-a-text"
                : "border-border bg-background text-muted-foreground hover:border-gilt hover:text-gilt-text"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`rounded-full border px-2.5 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring/70 ${
                activeTag === tag
                  ? "border-accent-a bg-accent-a/15 font-medium text-accent-a-text"
                  : "border-border bg-background text-muted-foreground hover:border-gilt hover:text-gilt-text"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No ideas in “{activeTag}”.</p>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="text-xs text-accent-a-text underline focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((idea) => (
            <li key={idea.id}>
              <Card className="h-full">
                <CardContent className="grid h-full gap-2">
                  <p className="display flex items-center gap-1.5 text-base font-semibold">
                    <Lightbulb aria-hidden="true" className="size-3.5 text-accent-a-text" />
                    {idea.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{idea.rationale}</p>
                  <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                    {idea.source === "rules" ? "Rule-based" : "Model-enriched"}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={savedIdeaIds.includes(idea.id)}
                      onClick={() => {
                        const wasSaved = savedIdeaIds.includes(idea.id);
                        toggleSavedIdea(idea.id);
                        setFeedback(
                          wasSaved
                            ? `${idea.title} removed from saved ideas`
                            : `${idea.title} saved`,
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-gilt focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {savedIdeaIds.includes(idea.id) ? (
                        <BookmarkCheck aria-hidden="true" className="size-3.5" />
                      ) : (
                        <Bookmark aria-hidden="true" className="size-3.5" />
                      )}
                      {savedIdeaIds.includes(idea.id) ? "Saved" : "Save idea"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={appliedIdeaIds.includes(idea.id)}
                      disabled={appliedIdeaIds.includes(idea.id)}
                      onClick={() => {
                        applyIdea(idea.id);
                        setFeedback(`${idea.title} added to the event brief`);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-gilt focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70"
                    >
                      <Check aria-hidden="true" className="size-3.5" />
                      {appliedIdeaIds.includes(idea.id) ? "Applied" : "Apply to event"}
                    </button>
                  </div>
                  {appliedIdeaIds.includes(idea.id) && (
                    <p className="text-xs text-muted-foreground">
                      Added to the event brief for future plan regeneration.
                    </p>
                  )}
                  {idea.tags.length > 0 && (
                    <ul className="mt-auto flex flex-wrap gap-1 pt-1">
                      {idea.tags.map((tag) => (
                        <li key={tag}>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {tag}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
