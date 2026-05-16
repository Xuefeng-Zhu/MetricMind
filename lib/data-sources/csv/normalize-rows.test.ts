import { describe, expect, it } from "vitest";

import type { InferredColumn } from "@/lib/data-sources/types";
import { normalizeRows } from "./normalize-rows";

const baseColumn = {
  nullable: false,
  nullRate: 0,
  uniqueCount: 2,
  sampleValues: [],
  isPii: false,
  semanticRole: "dimension",
  semanticType: "Dimension",
  suggestedSemanticType: "dimension",
  suggestedAggregation: null,
  qualityScore: 100,
} satisfies Omit<InferredColumn, "name" | "dataType" | "ordinalPosition">;

describe("normalizeRows", () => {
  it("casts values using inferred schema and preserves row indexes", () => {
    const rows = normalizeRows(
      [
        ["cus_1", "129900", "12.5", "true", ""],
        ["cus_2", "0", "8.25", "no", "Enterprise"],
      ],
      [
        { ...baseColumn, name: "customer_id", dataType: "text", ordinalPosition: 0 },
        { ...baseColumn, name: "mrr_cents", dataType: "integer", ordinalPosition: 1 },
        { ...baseColumn, name: "conversion_rate", dataType: "float", ordinalPosition: 2 },
        { ...baseColumn, name: "active", dataType: "boolean", ordinalPosition: 3 },
        { ...baseColumn, name: "plan", dataType: "text", ordinalPosition: 4 },
      ]
    );

    expect(rows).toEqual([
      {
        rowIndex: 0,
        data: {
          customer_id: "cus_1",
          mrr_cents: 129900,
          conversion_rate: 12.5,
          active: true,
          plan: null,
        },
      },
      {
        rowIndex: 1,
        data: {
          customer_id: "cus_2",
          mrr_cents: 0,
          conversion_rate: 8.25,
          active: false,
          plan: "Enterprise",
        },
      },
    ]);
  });
});
