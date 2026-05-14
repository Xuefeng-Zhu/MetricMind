/**
 * API Response Types
 *
 * These types mirror the shapes returned by existing API routes.
 * Fields use snake_case to match Supabase column naming conventions.
 */

// From GET /api/data-sources
export interface DataSourcesResponse {
  dataSources: Array<{
    id: string;
    workspace_id: string;
    name: string;
    type: string;
    status: string;
    created_at: string;
  }>;
}

// From GET /api/semantic/entities
export interface EntitiesResponse {
  entities: Array<{
    id: string;
    workspace_id: string;
    data_source_id: string;
    name: string;
    description: string | null;
    created_at: string;
  }>;
}

// From GET /api/semantic/metrics
export interface MetricsResponse {
  metrics: Array<{
    id: string;
    name: string;
    formula: string;
    owner: string;
    certified: boolean;
    certified_date: string | null;
  }>;
}

// From GET /api/semantic/joins
export interface JoinsResponse {
  joins: Array<{
    id: string;
    source_entity_id: string;
    target_entity_id: string;
    join_type: string;
    condition: string;
  }>;
}

// From GET /api/conversations
export interface ConversationsResponse {
  conversations: Array<{
    id: string;
    workspace_id: string;
    user_id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

// From GET /api/conversations/[id]/messages
export interface MessagesResponse {
  messages: Array<{
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
}

// From POST /api/ask
export interface AskResponse {
  success: boolean;
  data: {
    summary: string;
    sql: string;
    results: Record<string, unknown>[];
    metrics?: Array<{ label: string; value: string; trend: 'up' | 'down' }>;
    chartData?: Record<string, unknown>[];
    citations?: Array<{ label: string; source: string }>;
    aiTrace?: { id: string; steps: string[] };
    confidence?: number;
  };
}

// From GET /api/audit-logs
export interface AuditLogsResponse {
  events: Array<{
    id: string;
    workspace_id: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

// From GET /api/dashboards/[id]/insights (for executive dashboard)
export interface DashboardInsightsResponse {
  kpis: Array<{ label: string; value: string; trend: 'up' | 'down' | 'neutral'; trendValue: string }>;
  revenue: Array<{ month: string; mrr: number; starter: number; growth: number; enterprise: number }>;
  planMix: Array<{ plan: string; revenue: number }>;
  weeklyActiveUsers: Array<{ week: string; current: number; previous: number }>;
  topExpansionAccounts: Array<{ name: string; expansionMrr: number; growthPercent: number; plan: string }>;
  aiInsight: { summary: string; confidence: number; link: string };
}
