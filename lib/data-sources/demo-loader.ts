import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import { createDataSourceService, DataSource } from "./data-source-service";

/**
 * Demo metric definitions with formulas for the SaaS revenue analytics dataset.
 */
const DEMO_METRICS = [
  {
    name: "MRR",
    slug: "mrr",
    description:
      "Monthly Recurring Revenue - sum of all active subscription MRR values",
    formula: "SUM(subscriptions.mrr_cents) / 100 WHERE subscriptions.status = 'active'",
    rootEntity: "Subscription",
    measure: "subscription_mrr",
    timeDimension: "month",
    calculation: { type: "measure", measure: "subscription_mrr", aggregation: "sum" },
    filters: [{ field: "status", operator: "eq", value: "active" }],
  },
  {
    name: "ARR",
    slug: "arr",
    description:
      "Annual Recurring Revenue - MRR multiplied by 12",
    formula: "SUM(subscriptions.mrr_cents) / 100 * 12 WHERE subscriptions.status = 'active'",
    rootEntity: "Subscription",
    measure: "subscription_mrr",
    timeDimension: "month",
    calculation: { type: "measure", measure: "subscription_mrr", aggregation: "sum", multiplier: 12 },
    filters: [{ field: "status", operator: "eq", value: "active" }],
  },
  {
    name: "Churn Rate",
    slug: "churn_rate",
    description:
      "Percentage of customers who canceled their subscription in a given period",
    formula:
      "COUNT(subscriptions WHERE status = 'canceled' AND ended_at IN period) / COUNT(subscriptions WHERE started_at < period_start)",
    rootEntity: "Subscription",
    timeDimension: "week",
    calculation: {
      type: "expression",
      expression:
        "COUNT(DISTINCT CASE WHEN {root}.\"status\" = 'canceled' THEN {root}.\"customer_id\" END)::float / NULLIF(COUNT(DISTINCT {root}.\"customer_id\"), 0) * 100",
    },
    filters: [],
  },
  {
    name: "Active Users",
    slug: "active_users",
    description:
      "Count of unique customers with at least one product event in the last 30 days",
    formula:
      "COUNT(DISTINCT product_events.customer_id) WHERE product_events.occurred_at >= NOW() - INTERVAL '30 days'",
    rootEntity: "Product Event",
    timeDimension: "week",
    calculation: { type: "count", distinct: "customer_id" },
    filters: [],
  },
  {
    name: "Expansion Revenue",
    slug: "expansion_revenue",
    description:
      "Additional revenue from existing customers who upgraded their plan",
    formula:
      "SUM(invoices.amount_cents) / 100 WHERE invoices.status = 'paid'",
    rootEntity: "Invoice",
    measure: "invoice_amount",
    timeDimension: "month",
    calculation: { type: "measure", measure: "invoice_amount", aggregation: "sum" },
    filters: [{ field: "status", operator: "eq", value: "paid" }],
  },
  {
    name: "Support Ticket Volume",
    slug: "support_ticket_volume",
    description:
      "Total number of support tickets created in a given period",
    formula: "COUNT(support_tickets) WHERE support_tickets.created_at IN period",
    rootEntity: "Support Ticket",
    timeDimension: "week",
    calculation: { type: "count" },
    filters: [],
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
    name: "Customer",
    slug: "customer",
    description:
      "Customer accounts with plan, status, and demographic information",
    dimensions: [
      { name: "Customer ID", slug: "customer_id", source_column: "id", data_type: "text" as const, description: "Unique customer identifier" },
      { name: "Customer Email", slug: "customer_email", source_column: "email", data_type: "text" as const, description: "Customer email address", is_pii: true, required_role: "admin" as const },
      { name: "Plan", slug: "plan", source_column: "plan", data_type: "text" as const, description: "Subscription plan tier" },
      { name: "Region", slug: "region", source_column: "country", data_type: "text" as const, description: "Customer country used as region" },
      { name: "Segment", slug: "segment", source_column: "industry", data_type: "text" as const, description: "Customer industry segment" },
      { name: "Customer Created At", slug: "customer_created_at", source_column: "created_at", data_type: "timestamp" as const, description: "Account creation date" },
    ],
    measures: [] as Array<{ name: string; slug: string; source_column?: string; expression?: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }>,
  },
  {
    tableName: "subscriptions",
    name: "Subscription",
    slug: "subscription",
    description:
      "Subscription records with plan details, MRR, and lifecycle dates",
    dimensions: [
      { name: "Subscription ID", slug: "subscription_id", source_column: "id", data_type: "text" as const, description: "Unique subscription identifier" },
      { name: "Customer ID", slug: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "Plan", slug: "plan", source_column: "plan", data_type: "text" as const, description: "Plan tier name" },
      { name: "Status", slug: "status", source_column: "status", data_type: "text" as const, description: "Subscription status" },
      { name: "Month", slug: "month", source_column: "started_at", data_type: "timestamp" as const, description: "Subscription start month", time_grain: "month" as const },
      { name: "Week", slug: "week", source_column: "ended_at", data_type: "timestamp" as const, description: "Subscription end week", time_grain: "week" as const },
      { name: "Started At", slug: "started_at", source_column: "started_at", data_type: "timestamp" as const, description: "Subscription start date" },
      { name: "Ended At", slug: "ended_at", source_column: "ended_at", data_type: "timestamp" as const, description: "Subscription end date" },
    ],
    measures: [
      { name: "Subscription MRR", slug: "subscription_mrr", source_column: "mrr_cents", expression: "({alias}.\"mrr_cents\" / 100.0)", data_type: "float" as const, description: "Monthly recurring revenue in dollars", aggregation: "sum" as const },
    ],
  },
  {
    tableName: "invoices",
    name: "Invoice",
    slug: "invoice",
    description: "Invoice records with amounts, status, and payment dates",
    dimensions: [
      { name: "Invoice ID", slug: "invoice_id", source_column: "id", data_type: "text" as const, description: "Unique invoice identifier" },
      { name: "Customer ID", slug: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "Subscription ID", slug: "subscription_id", source_column: "subscription_id", data_type: "text" as const, description: "Associated subscription" },
      { name: "Status", slug: "status", source_column: "status", data_type: "text" as const, description: "Invoice status" },
      { name: "Month", slug: "month", source_column: "issued_at", data_type: "timestamp" as const, description: "Invoice issue month", time_grain: "month" as const },
      { name: "Week", slug: "week", source_column: "issued_at", data_type: "timestamp" as const, description: "Invoice issue week", time_grain: "week" as const },
    ],
    measures: [
      { name: "Invoice Amount", slug: "invoice_amount", source_column: "amount_cents", expression: "({alias}.\"amount_cents\" / 100.0)", data_type: "float" as const, description: "Invoice amount in dollars", aggregation: "sum" as const },
    ],
  },
  {
    tableName: "product_events",
    name: "Product Event",
    slug: "product_event",
    description: "User activity and product usage events with properties",
    dimensions: [
      { name: "Event ID", slug: "event_id", source_column: "id", data_type: "text" as const, description: "Unique event identifier" },
      { name: "Customer ID", slug: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "Product Area", slug: "product_area", source_column: "event_name", data_type: "text" as const, description: "Product area inferred from event name" },
      { name: "Month", slug: "month", source_column: "occurred_at", data_type: "timestamp" as const, description: "Event month", time_grain: "month" as const },
      { name: "Week", slug: "week", source_column: "occurred_at", data_type: "timestamp" as const, description: "Event week", time_grain: "week" as const },
    ],
    measures: [] as Array<{ name: string; slug: string; source_column?: string; expression?: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }>,
  },
  {
    tableName: "support_tickets",
    name: "Support Ticket",
    slug: "support_ticket",
    description: "Customer support tickets with priority, status, and resolution tracking",
    dimensions: [
      { name: "Ticket ID", slug: "ticket_id", source_column: "id", data_type: "text" as const, description: "Unique ticket identifier" },
      { name: "Customer ID", slug: "customer_id", source_column: "customer_id", data_type: "text" as const, description: "Associated customer" },
      { name: "Ticket Priority", slug: "ticket_priority", source_column: "priority", data_type: "text" as const, description: "Ticket priority level" },
      { name: "Status", slug: "status", source_column: "status", data_type: "text" as const, description: "Ticket status" },
      { name: "Month", slug: "month", source_column: "created_at", data_type: "timestamp" as const, description: "Ticket creation month", time_grain: "month" as const },
      { name: "Week", slug: "week", source_column: "created_at", data_type: "timestamp" as const, description: "Ticket creation week", time_grain: "week" as const },
    ],
    measures: [] as Array<{ name: string; slug: string; source_column?: string; expression?: string; data_type: "integer" | "float"; description: string; aggregation: "sum" | "count" | "average" | "min" | "max" }>,
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
  const dimensionMap = new Map<string, string>(); // Entity.Dimension slug -> dimension ID
  const measureMap = new Map<string, string>(); // Entity.Measure slug -> measure ID

  for (const entityDef of DEMO_ENTITIES) {
    const dataSourceId = dataSourceMap.get(entityDef.tableName);
    if (!dataSourceId) continue;
    const sourceTable = `demo.${entityDef.tableName}`;

    const { data: model, error: modelError } = await insforge
      .from("semantic_models")
      .insert({
        workspace_id: workspaceId,
        name: entityDef.name,
        slug: entityDef.slug,
        description: entityDef.description,
        source_table: sourceTable,
      })
      .select("id")
      .single();

    if (modelError || !model) {
      throw new Error(
        modelError?.message ?? `Failed to create semantic model: ${entityDef.name}`
      );
    }

    // Create the entity
    const { data: entity, error: entityError } = await insforge
      .from("semantic_entities")
      .insert({
        workspace_id: workspaceId,
        data_source_id: dataSourceId,
        model_id: model.id,
        name: entityDef.name,
        slug: entityDef.slug,
        description: entityDef.description,
        source_table: sourceTable,
        primary_key: "id",
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
        slug: dim.slug,
        description: dim.description,
        data_type: dim.data_type,
        source_column: dim.source_column,
        expression: null,
        time_grain: "time_grain" in dim ? dim.time_grain : null,
        is_pii: "is_pii" in dim ? dim.is_pii : false,
        required_role: "required_role" in dim ? dim.required_role : "viewer",
      }));

      const { data: createdDimensions, error: dimError } = await insforge
        .from("semantic_dimensions")
        .insert(dimensionInserts)
        .select("id, slug");

      if (dimError) {
        throw new Error(
          `Failed to create dimensions for ${entityDef.name}: ${dimError.message}`
        );
      }

      for (const dimension of (createdDimensions ?? []) as Array<{ id: string; slug: string }>) {
        dimensionMap.set(`${entityDef.name}.${dimension.slug}`, dimension.id);
      }
    }

    // Create measures
    if (entityDef.measures.length > 0) {
      const measureInserts = entityDef.measures.map((meas) => ({
        entity_id: entity.id,
        name: meas.name,
        slug: meas.slug,
        description: meas.description,
        data_type: meas.data_type,
        source_column: meas.source_column ?? null,
        expression: meas.expression ?? null,
        default_aggregation: meas.aggregation,
      }));

      const { data: createdMeasures, error: measError } = await insforge
        .from("semantic_measures")
        .insert(measureInserts)
        .select("id, slug");

      if (measError) {
        throw new Error(
          `Failed to create measures for ${entityDef.name}: ${measError.message}`
        );
      }

      for (const measure of (createdMeasures ?? []) as Array<{ id: string; slug: string }>) {
        measureMap.set(`${entityDef.name}.${measure.slug}`, measure.id);
      }
    }
  }

  const customerEntityId = entityMap.get("Customer");
  const relationshipDefinitions = [
    { source: "Subscription", sourceColumn: "customer_id", target: "Customer", targetColumn: "id" },
    { source: "Invoice", sourceColumn: "customer_id", target: "Customer", targetColumn: "id" },
    { source: "Product Event", sourceColumn: "customer_id", target: "Customer", targetColumn: "id" },
    { source: "Support Ticket", sourceColumn: "customer_id", target: "Customer", targetColumn: "id" },
  ];

  if (customerEntityId) {
    const relationshipInserts = relationshipDefinitions
      .map((relationship) => ({
        workspace_id: workspaceId,
        source_entity_id: entityMap.get(relationship.source),
        target_entity_id: entityMap.get(relationship.target),
        join_type: "left",
        source_column: relationship.sourceColumn,
        target_column: relationship.targetColumn,
      }))
      .filter(
        (relationship): relationship is {
          workspace_id: string;
          source_entity_id: string;
          target_entity_id: string;
          join_type: "left";
          source_column: string;
          target_column: string;
        } => !!relationship.source_entity_id && !!relationship.target_entity_id
      );

    if (relationshipInserts.length > 0) {
      const { error: relationshipError } = await insforge
        .from("semantic_relationships")
        .insert(relationshipInserts);

      if (relationshipError) {
        throw new Error(`Failed to create semantic relationships: ${relationshipError.message}`);
      }
    }
  }

  // 3. Create pre-configured metrics
  const metricIds: string[] = [];

  for (const metricDef of DEMO_METRICS) {
    const rootEntityId = entityMap.get(metricDef.rootEntity);
    if (!rootEntityId) {
      throw new Error(`Failed to create metric ${metricDef.name}: missing root entity`);
    }

    const { data: metric, error: metricError } = await insforge
      .from("metrics")
      .insert({
        workspace_id: workspaceId,
        name: metricDef.name,
        slug: metricDef.slug,
        description: metricDef.description,
        formula: metricDef.formula,
        certified: true,
        certified_by: userId,
        certified_at: new Date().toISOString(),
        created_by: userId,
        root_entity_id: rootEntityId,
        measure_id: "measure" in metricDef && metricDef.measure
          ? measureMap.get(`${metricDef.rootEntity}.${metricDef.measure}`) ?? null
          : null,
        time_dimension_id: dimensionMap.get(`${metricDef.rootEntity}.${metricDef.timeDimension}`) ?? null,
        calculation: metricDef.calculation,
        filters: metricDef.filters,
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
