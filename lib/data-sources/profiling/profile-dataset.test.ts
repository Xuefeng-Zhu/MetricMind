import { describe, expect, it } from "vitest";

import type { InferredColumn, NormalizedDatasetRow } from "@/lib/data-sources/types";
import { profileDataset } from "./profile-dataset";
import { calculateReadinessScore } from "./readiness-score";
import { generateSemanticSuggestions } from "./semantic-suggestions";

function column(
  patch: Partial<InferredColumn> & Pick<InferredColumn, "name" | "dataType" | "semanticRole">
): InferredColumn {
  return {
    name: patch.name,
    dataType: patch.dataType,
    nullable: patch.nullable ?? false,
    nullRate: patch.nullRate ?? 0,
    uniqueCount: patch.uniqueCount ?? 2,
    sampleValues: patch.sampleValues ?? ["sample"],
    isPii: patch.isPii ?? false,
    semanticRole: patch.semanticRole,
    semanticType: patch.semanticType ?? patch.name,
    suggestedSemanticType: patch.semanticRole === "measure" ? "measure" : "dimension",
    suggestedAggregation: patch.suggestedAggregation ?? null,
    qualityScore: patch.qualityScore ?? 96,
    ordinalPosition: patch.ordinalPosition ?? 0,
  };
}

describe("data source profiling", () => {
  const columns = [
    column({
      name: "subscription_id",
      dataType: "text",
      semanticRole: "primary_key",
      sampleValues: ["sub_1", "sub_2"],
    }),
    column({
      name: "customer_id",
      dataType: "text",
      semanticRole: "foreign_key",
      sampleValues: ["cus_1", "cus_2"],
    }),
    column({
      name: "email",
      dataType: "text",
      semanticRole: "pii",
      isPii: true,
      sampleValues: ["ada@example.com"],
    }),
    column({
      name: "mrr_cents",
      dataType: "integer",
      semanticRole: "measure",
      suggestedAggregation: "sum",
      sampleValues: ["129900", "249900"],
    }),
  ];
  const rows: NormalizedDatasetRow[] = [
    {
      rowIndex: 0,
      data: {
        subscription_id: "sub_1",
        customer_id: "cus_1",
        email: "ada@example.com",
        mrr_cents: 129900,
      },
    },
    {
      rowIndex: 1,
      data: {
        subscription_id: "sub_2",
        customer_id: "cus_2",
        email: "grace@example.com",
        mrr_cents: 249900,
      },
    },
  ];

  it("profiles row counts, column counts, PII, samples, and readiness", () => {
    const profile = profileDataset(rows, columns);

    expect(profile.rowCount).toBe(2);
    expect(profile.columnCount).toBe(4);
    expect(profile.piiColumnCount).toBe(1);
    expect(profile.sampleValues.mrr_cents).toEqual(["129900", "249900"]);
    expect(profile.semanticReadinessScore).toBeGreaterThan(70);
  });

  it("calculates zero readiness for empty datasets", () => {
    expect(
      calculateReadinessScore({
        rowCount: 0,
        columnCount: 4,
        nullRate: 0,
        piiColumnCount: 0,
        typedColumnCount: 4,
        semanticColumnCount: 4,
      })
    ).toBe(0);
  });

  it("generates semantic suggestions for entities, MRR, joins, and PII policy", () => {
    const suggestions = generateSemanticSuggestions("subscriptions", columns);

    expect(suggestions.map((suggestion) => suggestion.type)).toEqual([
      "dimension",
      "metric",
      "relationship",
      "policy",
    ]);
    expect(suggestions.find((suggestion) => suggestion.type === "metric")?.title).toBe(
      "Define Monthly Recurring Revenue"
    );
  });
});
