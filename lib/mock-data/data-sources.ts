import { DataSource, Dataset, SchemaColumn } from './types';

// ─── Data Sources ───────────────────────────────────────────────────────────

export const dataSources: DataSource[] = [
  {
    id: 'ds-csv-001',
    name: 'CSV Upload',
    type: 'csv',
    status: 'Active',
    icon: 'file-text',
  },
  {
    id: 'ds-db-001',
    name: 'Database',
    type: 'database',
    status: 'Demo',
    icon: 'database',
  },
  {
    id: 'ds-sf-001',
    name: 'Salesforce',
    type: 'salesforce',
    status: 'Coming Soon',
    icon: 'cloud',
  },
];

// ─── Datasets ───────────────────────────────────────────────────────────────

export const datasets: Dataset[] = [
  {
    id: 'dataset-001',
    name: 'subscriptions.csv',
    rows: 24853,
    columns: 12,
    qualityScore: 94,
    semanticCoverage: 87,
    lastUpdated: '2024-04-12',
  },
  {
    id: 'dataset-002',
    name: 'customers.csv',
    rows: 8421,
    columns: 18,
    qualityScore: 91,
    semanticCoverage: 92,
    lastUpdated: '2024-04-10',
  },
  {
    id: 'dataset-003',
    name: 'invoices.csv',
    rows: 156204,
    columns: 9,
    qualityScore: 88,
    semanticCoverage: 76,
    lastUpdated: '2024-04-08',
  },
  {
    id: 'dataset-004',
    name: 'support_tickets.csv',
    rows: 3892,
    columns: 14,
    qualityScore: 82,
    semanticCoverage: 68,
    lastUpdated: '2024-04-05',
  },
  {
    id: 'dataset-005',
    name: 'product_events.csv',
    rows: 1284000,
    columns: 7,
    qualityScore: 97,
    semanticCoverage: 54,
    lastUpdated: '2024-04-11',
  },
];

// ─── Schema Columns ─────────────────────────────────────────────────────────

export const schemaColumns: SchemaColumn[] = [
  {
    name: 'customer_id',
    inferredType: 'string',
    semanticType: 'dimension',
  },
  {
    name: 'subscription_amount',
    inferredType: 'number',
    semanticType: 'measure',
  },
  {
    name: 'plan_name',
    inferredType: 'string',
    semanticType: 'dimension',
  },
  {
    name: 'created_at',
    inferredType: 'date',
    semanticType: 'dimension',
  },
  {
    name: 'status',
    inferredType: 'string',
    semanticType: 'dimension',
  },
  {
    name: 'mrr',
    inferredType: 'number',
    semanticType: 'measure',
  },
  {
    name: 'churn_date',
    inferredType: 'date',
    semanticType: 'dimension',
  },
  {
    name: 'lifetime_value',
    inferredType: 'number',
    semanticType: 'measure',
  },
  {
    name: 'email',
    inferredType: 'string',
    semanticType: 'pii',
  },
  {
    name: 'engagement_score',
    inferredType: 'number',
    semanticType: 'measure',
  },
];

// ─── Connector Roadmap ──────────────────────────────────────────────────────

export interface ConnectorRoadmapItem {
  name: string;
  status: string;
  quarter: string;
}

export const connectorRoadmap: ConnectorRoadmapItem[] = [
  {
    name: 'PostgreSQL',
    status: 'In Development',
    quarter: 'Q1 2025',
  },
  {
    name: 'Snowflake',
    status: 'Planned',
    quarter: 'Q2 2025',
  },
  {
    name: 'BigQuery',
    status: 'Planned',
    quarter: 'Q2 2025',
  },
];
