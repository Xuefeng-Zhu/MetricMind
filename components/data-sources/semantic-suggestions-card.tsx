import { BrainCircuit, GitBranch, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SemanticSuggestion, SemanticSuggestionType } from "@/lib/data-sources/types";

interface SemanticSuggestionsCardProps {
  suggestions: SemanticSuggestion[];
  onApplySuggestion: (suggestion: SemanticSuggestion) => void;
}

const suggestionIcons: Record<SemanticSuggestionType, LucideIcon> = {
  metric: BrainCircuit,
  dimension: KeyRound,
  relationship: GitBranch,
  policy: ShieldCheck,
};

export function SemanticSuggestionsCard({
  suggestions,
  onApplySuggestion,
}: SemanticSuggestionsCardProps) {
  return (
    <section aria-label="AI semantic suggestions" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">AI semantic suggestions</h3>
          <p className="text-xs text-[#6B7280]">Suggested metrics, dimensions, joins, and policies.</p>
        </div>
        <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#CBD5E1] p-4 text-sm text-[#6B7280]">
          Select a profiled dataset to see AI suggestions.
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const Icon = suggestionIcons[suggestion.type];
            return (
              <article
                key={suggestion.id}
                className="rounded-md border border-[#E5E7EB] bg-[#FBFDFF] p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#111827]">
                        {suggestion.title}
                      </h4>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE]">
                        {suggestion.confidence}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#4B5563]">
                      {suggestion.description}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onApplySuggestion(suggestion)}
                      className="mt-2 h-8 px-2 text-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                    >
                      {suggestion.actionLabel}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
