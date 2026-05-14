import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import { createDataSourceService, DataSource } from "./data-source-service";

/**
 * Demo metric definitions with formulas for the SaaS revenue analytics dataset.
 */
const DEMO_METRICS = [
  {
    name: "MRR",
    description:
      "Monthly Recurring Revenue - sum of all active subscription MRR values",
    formula: "SUM(subscriptions.mrr_cents) / 100 WHERE subscriptions.status = 'active'",
  },
  {
    name: "ARR",
    description:
      "Annual Recurring Revenue - MRR multiplied by 12",
    formula: "SUM(subscriptions.mrr_cents) / 100 * 12 WHERE subscriptions.status = 'active'",
  },
  {
    name: "Churn Rate",
    description:
      "Percentage of customers who canceled their subscription in a given period",
    formula:
      "COUNT(subscriptions WHERE status = 'canceled' AND ended_at IN period) / COUNT(subscriptions WHERE started_at < period_start)",
  },
  {
    name: "Active Users",
    description:
      "Count of unique customers with at least one product event in the last 30 days",
    formula:
      "COUNT(DISTINCT product_events.customer_id) WHERE product_events.occurred_at >= NOW() - INTERVAL '30 days'",
  },
  {
    name: "ARPA",
    description:
      "Average Revenue Per Account - MRR divided by number of active customers",
    formula:
      "SUM(subscriptions.mrr_cents) / 100 / COUNT(DISTINCT subscriptions.customer_id) WHERE subscriptions.status = 'active'",
  },
  {
    name: "NRR",
    description:
      "Net Revenue Retention - measures revenue retained from existing customers including expansion and contraction",
    formula:
      "(MRR_end_of_period - MRR_from_new_customers) / MRR_start_of_period * 100",
  },
  {
    name: "Expansion Revenue",
    description:
      "Additional revenue from existing customers who upgraded their plan",
    formula:
      "SUM(new_mrr - old_mrr) WHERE subscription plan upgraded in period",
  },
  {
    name: "Support Ticket Volume",
    description:
      "Total number of support tickets created in a given period",
    formula: "COUNT(support_tickets) WHERE support_tickets.created_at IN period",
  },
];

/**
 * Demo glossary terms for key SaaS business concepts.
 */
const DEMO_GLOSSARY_TERMS = [
  {
    name: "MRR",
    definition:
      "Monthly Recurring Revenue. The predictable revenue a business earns each month from active subscriptions. Calculated as the sum of all active subscription monthly fees.",
  },
  {
    name: "ARR",
    definition:
      "Annual Recurring Revenue. The annualized value of recurring revenue, calculated as MRR multiplied by 12. Used for long-term revenue forecasting.",
  },
  {
    name: "Churn",
    definition:
      "The rate at which customers cancel their subscriptions. Can be measured as customer churn (count) or revenue churn (dollar value lost).",
  },
  {
    name: "NRR",
    definition:
      "Net Revenue Retention. Measures how much revenue is retained from existing customers over a period, including expansion (upgrades) and contraction (downgrades). Values above 100% indicate net expansion.",
  },
  {
    name: "ARPA",
    definition:
      "Average Revenue Per Account. The mean monthly revenue generated per active customer account. Useful for understanding pricing efficiency.",
  },
  {
    name: "Expansion Revenue",
    definition:
      "Additional revenue generated from existing customers through plan upgrades, add-ons, or increased usage. A key driver of NRR above 100%.",
  },
  {
    name: "Customer Health Score",
    definition:
      "A composite metric combining product usage frequency, support ticket volume, payment history, and engagement patterns to predict churn risk.",
  },
  {
    name: "LTV",
    definition:
      "Lifetime Value. The total revenue expected from a customer over their entire relationship with the business. Calculated as ARPA divided by churn rate.",
  },
];

/**
 * Demo dashboard configurations.
 */
const DEMO_DASHBOARDS = [
  {
    name: "Executive Overview",
    description:
      "High-level KPIs and trends for executive stakeholders including MRR, ARR, customer count, and churn rate.",
  },
  {
    name: "Revenue",
    description:
      "Detailed revenue analytics including MRR trends, expansion revenue, plan distribution, and payment metrics.",
  },
  {
    name: "Product Usage",
    description:
      "Product engagement metrics including active users, feature adoption, session frequency, and usage patterns.",
  },
  {
    name: "Customer Health",
    description:
      "Customer health indicators including churn risk, support ticket trends, satisfaction scores, and retention cohorts.",
  },
];

/**
 * Semantic entity definitions for each demo table.
 */
const DEMO_ENTITIES = [
  {
    tableName: "customers",
    name: "Customers",
    description:
      "Customer accounts with plan, status, and demographic information",
    dimensions: [
      { name: "customer_id", source_column: "id", data_type: "text" as const, description: "Unique customer identifier" },
      { name: "name", source_column: "name", data_type: "text" as const, description: "Customer full name" },
      { name: "company", source_column: "company", data_type: "text" as const, description: "Customer company name" },
      { name: "plan", source_column: "plan", data_type: "text" as const, description: "Subscription plan tier" },
      { name: "status", source_column: "status", data_type: "text" as const, description: "Customer account status" },
      { name: "country", source_column: "country", data_type: "text" as const, description: "Customer country code" },
      { name: "industry", source_column: "industry", data_type: "text" as const, description: "Customer industry vertical" },
      { name: "created_at", source_column: "created_at", data_type: "timestamp" as const, description: "Account creation date" },
    ],
    measures: [] as { name: string; source_column: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }[],
  },
  {
    tableName: "subscriptions",
    name: "Subscriptions",
    description:
      "Subscription records with plan details, MRR, and lifecycle dates",
    dimensions: [
      { name: "subscription_id", source_column: "id", data_type: "text" as const, description: "Unique subscription identifier" },
      { name: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "plan", source_column: "plan", data_type: "text" as const, description: "Plan tier name" },
      { name: "status", source_column: "status", data_type: "text" as const, description: "Subscription status (active, canceled)" },
      { name: "billing_interval", source_column: "billing_interval", data_type: "text" as const, description: "Billing frequency" },
      { name: "started_at", source_column: "started_at", data_type: "timestamp" as const, description: "Subscription start date" },
      { name: "ended_at", source_column: "ended_at", data_type: "timestamp" as const, description: "Subscription end date (if canceled)" },
    ],
    measures: [
      { name: "mrr_cents", source_column: "mrr_cents", data_type: "integer" as const, description: "Monthly recurring revenue in cents", aggregation: "sum" as const },
    ],
  },
  {
    tableName: "invoices",
    name: "Invoices",
    description: "Invoice records with amounts, status, and payment dates",
    dimensions: [
      { name: "invoice_id", source_column: "id", data_type: "text" as const, description: "Unique invoice identifier" },
      { name: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "subscription_id", source_column: "subscription_id", data_type: "text" as const, description: "Associated subscription" },
      { name: "currency", source_column: "currency", data_type: "text" as const, description: "Invoice currency" },
      { name: "status", source_column: "status", data_type: "text" as const, description: "Invoice status (paid, void, pending)" },
      { name: "issued_at", source_column: "issued_at", data_type: "timestamp" as const, description: "Invoice issue date" },
      { name: "paid_at", source_column: "paid_at", data_type: "timestamp" as const, description: "Payment received date" },
    ],
    measures: [
      { name: "amount_cents", source_column: "amount_cents", data_type: "integer" as const, description: "Invoice amount in cents", aggregation: "sum" as const },
    ],
  },
  {
    tableName: "payments",
    name: "Payments",
    description: "Payment transaction records with amounts and processing details",
    dimensions: [
      { name: "payment_id", source_column: "id", data_type: "text" as const, description: "Unique payment identifier" },
      { name: "invoice_id", source_column: "invoice_id", data_type: "text" as const, description: "Associated invoice" },
      { name: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "method", source_column: "method", data_type: "text" as const, description: "Payment method (card, wire)" },
      { name: "status", source_column: "status", data_type: "text" as const, description: "Payment status" },
      { name: "processed_at", source_column: "processed_at", data_type: "timestamp" as const, description: "Payment processing timestamp" },
    ],
    measures: [
      { name: "amount_cents", source_column: "amount_cents", data_type: "integer" as const, description: "Payment amount in cents", aggregation: "sum" as const },
    ],
  },
  {
    tableName: "product_events",
    name: "Product Events",
    description: "User activity and product usage events with properties",
    dimensions: [
      { name: "event_id", source_column: "id", data_type: "text" as const, description: "Unique event identifier" },
      { name: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "event_name", source_column: "event_name", data_type: "text" as const, description: "Type of product event" },
      { name: "session_id", source_column: "session_id", data_type: "text" as const, description: "User session identifier" },
      { name: "occurred_at", source_column: "occurred_at", data_type: "timestamp" as const, description: "Event timestamp" },
    ],
    measures: [] as { name: string; source_column: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }[],
  },
  {
    tableName: "support_tickets",
    name: "Support Tickets",
    description: "Customer support tickets with priority, status, and resolution tracking",
    dimensions: [
      { name: "ticket_id", source_column: "id", data_type: "text" as const, description: "Unique ticket identifier" },
      { name: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "subject", source_column: "subject", data_type: "text" as const, description: "Ticket subject line" },
      { name: "priority", source_column: "priority", data_type: "text" as const, description: "Ticket priority level" },
      { name: "status", source_column: "status", data_type: "text" as const, description: "Ticket status (open, resolved)" },
      { name: "category", source_column: "category", data_type: "text" as const, description: "Ticket category" },
      { name: "created_at", source_column: "created_at", data_type: "timestamp" as const, description: "Ticket creation date" },
      { name: "resolved_at", source_column: "resolved_at", data_type: "timestamp" as const, description: "Ticket resolution date" },
    ],
    measures: [] as { name: string; source_column: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }[],
  },
];

export interface DemoLoadResult {
  dataSources: DataSource[];
  entityIds: string[];
  metricIds: string[];
  glossaryTermIds: string[];
  dashboardIds: string[];
}

/**
 * Loads the complete demo dataset for a workspace including:
 * 1. Data source records for each demo table
 * 2. Semantic entities with dimensions and measures
 * 3. Pre-configured metrics (MRR, ARR, Churn Rate, etc.)
 * 4. Glossary terms for key business concepts
 * 5. Four demo dashboards
 *
 * @param insforge - Authenticated InsForge client
 * @param workspaceId - Target workspace ID
 * @param userId - User ID for created_by fields
 * @returns IDs of all created resources
 */
export async function loadFullDemoDataset(
  insforge: InsForgeDatabaseClient,
  workspaceId: string,
  userId: string
): Promise<DemoLoadResult> {
  // 1. Create data source records via the data source service
  const dataSourceService = createDataSourceService(insforge);
  const dataSources = await dataSourceService.loadDemoDataset(workspaceId);

  // Build a map of table name -> data source ID for entity creation
  const dataSourceMap = new Map<string, string>();
  for (const ds of dataSources) {
    dataSourceMap.set(ds.name, ds.id);
  }

  // 2. Create semantic entities with dimensions and measures
  const entityIds: string[] = [];
  const entityMap = new Map<string, string>(); // entity name -> entity ID

  for (const entityDef of DEMO_ENTITIES) {
    const dataSourceId = dataSourceMap.get(entityDef.tableName);
    if (!dataSourceId) continue;

    // Create the entity
    const { data: entity, error: entityError } = await insforge
      .from("semantic_entities")
      .insert({
        workspace_id: workspaceId,
        data_source_id: dataSourceId,
        name: entityDef.name,
        description: entityDef.description,
      })
      .select("id")
      .single();

    if (entityError || !entity) {
      throw new Error(
        entityError?.message ?? `Failed to create entity: ${entityDef.name}`
      );
    }

    entityIds.push(entity.id);
    entityMap.set(entityDef.name, entity.id);

    // Create dimensions
    if (entityDef.dimensions.length > 0) {
      const dimensionInserts = entityDef.dimensions.map((dim) => ({
        entity_id: entity.id,
        name: dim.name,
        description: dim.description,
        data_type: dim.data_type,
        source_column: dim.source_column,
      }));

      const { error: dimError } = await insforge
        .from("dimensions")
        .insert(dimensionInserts);

      if (dimError) {
        throw new Error(
          `Failed to create dimensions for ${entityDef.name}: ${dimError.message}`
        );
      }
    }

    // Create measures
    if (entityDef.measures.length > 0) {
      const measureInserts = entityDef.measures.map((meas) => ({
        entity_id: entity.id,
        name: meas.name,
        description: meas.description,
        data_type: meas.data_type,
        source_column: meas.source_column,
        default_aggregation: meas.aggregation,
      }));

      const { error: measError } = await insforge
        .from("measures")
        .insert(measureInserts);

      if (measError) {
        throw new Error(
          `Failed to create measures for ${entityDef.name}: ${measError.message}`
        );
      }
    }
  }

  // 3. Create pre-configured metrics
  const metricIds: string[] = [];

  for (const metricDef of DEMO_METRICS) {
    const { data: metric, error: metricError } = await insforge
      .from("metrics")
      .insert({
        workspace_id: workspaceId,
        name: metricDef.name,
        description: metricDef.description,
        formula: metricDef.formula,
        certified: true,
        certified_by: userId,
        certified_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();

    if (metricError || !metric) {
      throw new Error(
        metricError?.message ?? `Failed to create metric: ${metricDef.name}`
      );
    }

    metricIds.push(metric.id);
  }

  // 4. Create glossary terms
  const glossaryTermIds: string[] = [];

  for (const termDef of DEMO_GLOSSARY_TERMS) {
    const { data: term, error: termError } = await insforge
      .from("glossary_terms")
      .insert({
        workspace_id: workspaceId,
        name: termDef.name,
        definition: termDef.definition,
        related_metric_ids: [],
        related_entity_ids: [],
      })
      .select("id")
      .single();

    if (termError || !term) {
      throw new Error(
        termError?.message ?? `Failed to create glossary term: ${termDef.name}`
      );
    }

    glossaryTermIds.push(term.id);
  }

  // 5. Create demo dashboards with placeholder widgets
  const dashboardIds: string[] = [];

  for (const dashDef of DEMO_DASHBOARDS) {
    const { data: dashboard, error: dashError } = await insforge
      .from("dashboards")
      .insert({
        workspace_id: workspaceId,
        name: dashDef.name,
        description: dashDef.description,
        created_by: userId,
      })
      .select("id")
      .single();

    if (dashError || !dashboard) {
      throw new Error(
        dashError?.message ?? `Failed to create dashboard: ${dashDef.name}`
      );
    }

    dashboardIds.push(dashboard.id);
  }

  // Add KPI widgets to Executive Overview dashboard
  const execDashboardId = dashboardIds[0];
  const kpiWidgets = [
    {
      dashboard_id: execDashboardId,
      type: "kpi",
      config: { title: "MRR", value: "$32,490", change: "+5.2%", period: "vs last month" },
      pos_x: 0,
      pos_y: 0,
      width: 3,
      height: 2,
    },
    {
      dashboard_id: execDashboardId,
      type: "kpi",
      config: { title: "ARR", value: "$389,880", change: "+5.2%", period: "vs last month" },
      pos_x: 3,
      pos_y: 0,
      width: 3,
      height: 2,
    },
    {
      dashboard_id: execDashboardId,
      type: "kpi",
      config: { title: "Active Customers", value: "16", change: "-2", period: "vs last month" },
      pos_x: 6,
      pos_y: 0,
      width: 3,
      height: 2,
    },
    {
      dashboard_id: execDashboardId,
      type: "kpi",
      config: { title: "Churn Rate", value: "4.2%", change: "+0.8%", period: "vs last month" },
      pos_x: 9,
      pos_y: 0,
      width: 3,
      height: 2,
    },
  ];

  const { error: widgetError } = await insforge
    .from("widgets")
    .insert(kpiWidgets);

  if (widgetError) {
    throw new Error(`Failed to create dashboard widgets: ${widgetError.message}`);
  }

  return {
    dataSources,
    entityIds,
    metricIds,
    glossaryTermIds,
    dashboardIds,
  };
}
