import { describe, expect, it } from "vitest";

import { inferSchema, detectPii } from "./infer-schema";

describe("inferSchema", () => {
  it("infers data types, semantic roles, PII, and aggregation hints", () => {
    const columns = inferSchema(
      ["subscription_id", "customer_id", "email", "mrr_cents", "created_at", "active"],
      [
        ["sub_1", "cus_1", "ada@example.com", "129900", "2026-01-01T10:00:00Z", "true"],
        ["sub_2", "cus_2", "grace@example.com", "249900", "2026-02-01T10:00:00Z", "false"],
      ]
    );

    expect(columns.find((column) => column.name === "subscription_id")).toMatchObject({
      dataType: "text",
      semanticRole: "primary_key",
      suggestedSemanticType: "dimension",
    });
    expect(columns.find((column) => column.name === "customer_id")).toMatchObject({
      semanticRole: "primary_key",
    });
    expect(columns.find((column) => column.name === "email")).toMatchObject({
      isPii: true,
      semanticRole: "pii",
    });
    expect(columns.find((column) => column.name === "mrr_cents")).toMatchObject({
      dataType: "integer",
      semanticRole: "measure",
      suggestedAggregation: "sum",
    });
    expect(columns.find((column) => column.name === "created_at")).toMatchObject({
      dataType: "timestamp",
      semanticRole: "timestamp",
    });
    expect(columns.find((column) => column.name === "active")).toMatchObject({
      dataType: "boolean",
      semanticRole: "dimension",
    });
  });

  it("detects PII from sample values even when the column name is generic", () => {
    expect(detectPii("owner", ["a@example.com", "b@example.com", "internal"])).toBe(true);
  });

  it("marks null-heavy columns as nullable and lowers quality score", () => {
    const [column] = inferSchema(["plan"], [["Enterprise"], [""], ["Team"], [""]]);

    expect(column.nullable).toBe(true);
    expect(column.nullRate).toBe(0.5);
    expect(column.qualityScore).toBeLessThan(100);
  });
});
