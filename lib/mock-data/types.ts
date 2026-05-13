// Mock data TypeScript interfaces for MetricMind UI

// ─── KPI Metrics ────────────────────────────────────────────────────────────

export interface KPIMetric {
  id: string;
  label: string;
  value: string;
  numericValue: number;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  trendPercentage: number;
}

// ─── Revenue ────────────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  month: string;
  mrr: number;
  arr: number;
  starter: number;
  growth: number;
  enterprise: number;
}

// ─── Churn & Risk ───────────────────────────────────────────────────────────

export interface ChurnCohort {
  cohort: string;
  churnRate: number;
  count: number;
}

export interface AtRiskAccount {
  name: string;
  mrr: number;
  riskScore: number;
  daysSinceEngagement: number;
  status: 'critical' | 'warning' | 'monitoring';
}

export interface ChurnDriver {
  name: string;
  percentage: number;
  value: number;
}

// ─── Semantic Layer ─────────────────────────────────────────────────────────

export interface SemanticEntity {
  id: string;
  name: string;
  recordCount: number;
  color: string;
  dimensions: string[];
  measures: string[];
}

export interface EntityRelationship {
  source: string;
  target: string;
  type: 'has_many' | 'belongs_to' | 'has_one';
  label: string;
}

export interface CertifiedMetric {
  id: string;
  name: string;
  formula: string;
  sql: string;
  owner: string;
  certifiedDate: string;
  aiUsageCount: number;
  timeDimension: string;
  synonyms: string[];
  aiPolicy: string;
}

// ─── Conversations & AI ─────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

export interface Citation {
  label: string;
  source: string;
}

export interface TraceStep {
  step: number;
  label: string;
}

export interface AIAnswer {
  question: string;
  confidence: number;
  summary: string;
  metrics: { label: string; value: string; trend: 'up' | 'down' }[];
  chartData: Record<string, unknown>[];
  citations: Citation[];
  traceSteps: string[];
  nextQuestions: string[];
  sql: string;
}

// ─── Data Sources ───────────────────────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  icon: string;
}

export interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  qualityScore: number;
  semanticCoverage: number;
  lastUpdated: string;
}

export interface SchemaColumn {
  name: string;
  inferredType: string;
  semanticType: string;
}

// ─── Audit & Governance ─────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorAvatar: string;
  actionType: string;
  target: string;
  status: string;
}

export interface GovernanceControl {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

// ─── Accounts & Users ───────────────────────────────────────────────────────

export interface AccountExpansion {
  name: string;
  expansionMrr: number;
  growthPercent: number;
  plan: string;
}

export interface WeeklyActiveUsers {
  week: string;
  current: number;
  previous: number;
}
