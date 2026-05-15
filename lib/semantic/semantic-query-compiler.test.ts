import { describe, expect, it } from "vitest";
import { compileSemanticQuery } from "./semantic-query-compiler";
import type { SemanticRegistry } from "./types";

const registry: SemanticRegistry = {
  workspaceId: "ws1",
  models: [],
  entities: [
    {
      id: "customer",
      workspaceId: "ws1",
      dataSourceId: "ds_customers",
      modelId: "model_customers",
      name: "Customer",
      slug: "customer",
      description: null,
      sourceTable: "demo.customers",
      primaryKey: "id",
      createdAt: "2024-01-01",
    },
    {
      id: "subscription",
      workspaceId: "ws1",
      dataSourceId: "ds_subscriptions",
      modelId: "model_subscriptions",
      name: "Subscription",
      slug: "subscription",
      description: null,
      sourceTable: "demo.subscriptions",
      primaryKey: "id",
      createdAt: "2024-01-01",
    },
    {
      id: "support_ticket",
      workspaceId: "ws1",
      dataSourceId: "ds_tickets",
      modelId: "model_tickets",
      name: "Support Ticket",
      slug: "support_ticket",
      description: null,
      sourceTable: "demo.support_tickets",
      primaryKey: "id",
      createdAt: "2024-01-01",
    },
  ],
  dimensions: [
    { id: "dim_month", entityId: "subscription", name: "Month", slug: "month", description: null, dataType: "timestamp", sourceColumn: "started_at", expression: null, timeGrain: "month", isPii: false, requiredRole: "viewer" },
    { id: "dim_week", entityId: "subscription", name: "Week", slug: "week", description: null, dataType: "timestamp", sourceColumn: "ended_at", expression: null, timeGrain: "week", isPii: false, requiredRole: "viewer" },
    { id: "dim_plan", entityId: "subscription", name: "Plan", slug: "plan", description: null, dataType: "text", sourceColumn: "plan", expression: null, timeGrain: null, isPii: false, requiredRole: "viewer" },
    { id: "dim_status", entityId: "subscription", name: "Status", slug: "status", description: null, dataType: "text", sourceColumn: "status", expression: null, timeGrain: null, isPii: false, requiredRole: "viewer" },
    { id: "dim_customer_email", entityId: "customer", name: "Customer Email", slug: "customer_email", description: null, dataType: "text", sourceColumn: "email", expression: null, timeGrain: null, isPii: true, requiredRole: "admin" },
    { id: "dim_ticket_priority", entityId: "support_ticket", name: "Ticket Priority", slug: "ticket_priority", description: null, dataType: "text", sourceColumn: "priority", expression: null, timeGrain: null, isPii: false, requiredRole: "viewer" },
  ],
  measures: [
    { id: "measure_mrr", entityId: "subscription", name: "Subscription MRR", slug: "subscription_mrr", description: null, dataType: "float", sourceColumn: "mrr_cents", expression: "({alias}.\"mrr_cents\" / 100.0)", defaultAggregation: "sum" },
  ],
  metrics: [
    {
      id: "metric_mrr",
      workspaceId: "ws1",
      name: "MRR",
      slug: "mrr",
      description: null,
      formula: "SUM(subscription_mrr) WHERE status = active",
      certified: true,
      certifiedBy: "u1",
      certifiedAt: "2024-01-01",
      createdAt: "2024-01-01",
      createdBy: "u1",
      rootEntityId: "subscription",
      measureId: "measure_mrr",
      timeDimensionId: "dim_month",
      calculation: { type: "measure", measure: "subscription_mrr", aggregation: "sum" },
      filters: [{ field: "status", operator: "eq", value: "active" }],
    },
    {
      id: "metric_churn",
      workspaceId: "ws1",
      name: "Churn Rate",
      slug: "churn_rate",
      description: null,
      formula: "churned customers / total customers",
      certified: true,
      certifiedBy: "u1",
      certifiedAt: "2024-01-01",
      createdAt: "2024-01-01",
      createdBy: "u1",
      rootEntityId: "subscription",
      measureId: null,
      timeDimensionId: "dim_week",
      calculation: {
        type: "expression",
        expression:
          "COUNT(DISTINCT CASE WHEN {root}.\"status\" = 'canceled' THEN {root}.\"customer_id\" END)::float / NULLIF(COUNT(DISTINCT {root}.\"customer_id\"), 0) * 100",
      },
      filters: [],
    },
  ],
  relationships: [
    {
      id: "rel_subscription_customer",
      workspaceId: "ws1",
      sourceEntityId: "subscription",
      targetEntityId: "customer",
      joinType: "left",
      sourceColumn: "customer_id",
      targetColumn: "id",
    },
    {
      id: "rel_ticket_customer",
      workspaceId: "ws1",
      sourceEntityId: "support_ticket",
      targetEntityId: "customer",
      joinType: "left",
      sourceColumn: "customer_id",
      targetColumn: "id",
    },
  ],
  glossaryTerms: [],
};

describe("compileSemanticQuery", () => {
  it("compiles MRR by month", () => {
    const compiled = compileSemanticQuery(registry, {
      metrics: ["mrr"],
      time: { dimension: "month", grain: "month" },
    });

    expect(compiled.sql).toContain("DATE_TRUNC('month'");
    expect(compiled.sql).toContain("SUM((t0.\"mrr_cents\" / 100.0))");
    expect(compiled.sql).toContain("WHERE t0.\"status\" = 'active'");
    expect(compiled.sql).toContain("GROUP BY 1");
    expect(compiled.sql).toMatch(/^SELECT\b/);
  });

  it("compiles MRR by plan", () => {
    const compiled = compileSemanticQuery(registry, {
      metrics: ["mrr"],
      dimensions: ["plan"],
    });

    expect(compiled.sql).toContain('t0."plan" AS "plan"');
    expect(compiled.sql).toContain("GROUP BY 1");
  });

  it("compiles churn rate by week", () => {
    const compiled = compileSemanticQuery(registry, {
      metrics: ["churn_rate"],
      time: { dimension: "week", grain: "week" },
    });

    expect(compiled.sql).toContain("DATE_TRUNC('week'");
    expect(compiled.sql).toContain("COUNT(DISTINCT CASE WHEN t0.\"status\" = 'canceled'");
  });

  it("rejects unknown metric", () => {
    expect(() => compileSemanticQuery(registry, { metrics: ["made_up"] })).toThrow("Unknown metric");
  });

  it("rejects unknown dimension", () => {
    expect(() => compileSemanticQuery(registry, { metrics: ["mrr"], dimensions: ["made_up"] })).toThrow("Unknown dimension");
  });

  it("rejects incompatible dimension", () => {
    expect(() => compileSemanticQuery(registry, { metrics: ["mrr"], dimensions: ["ticket_priority"] })).toThrow("Incompatible dimension");
  });

  it("rejects unauthorized PII dimension", () => {
    expect(() => compileSemanticQuery(registry, { metrics: ["mrr"], dimensions: ["customer_email"] }, { userRole: "viewer" })).toThrow("Unauthorized PII dimension");
  });

  it("ensures generated SQL is SELECT-only", () => {
    const compiled = compileSemanticQuery(registry, { metrics: ["mrr"] });

    expect(compiled.sql).toMatch(/^SELECT\b/);
    expect(compiled.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
  });

  it("enforces max limit", () => {
    const compiled = compileSemanticQuery(registry, { metrics: ["mrr"], limit: 10000 }, { maxLimit: 250 });

    expect(compiled.limit).toBe(250);
    expect(compiled.sql).toContain("LIMIT 250");
  });
});
