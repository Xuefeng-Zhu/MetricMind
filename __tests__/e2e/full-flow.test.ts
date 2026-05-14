/**
 * End-to-End Integration Tests
 *
 * Tests the complete MetricMind flow using mocked InsForge clients:
 * 1. Full pipeline: signup → workspace → CSV upload → entity → ask question → chart → dashboard
 * 2. RBAC role-based access restrictions
 * 3. Governance engine blocks dangerous queries
 *
 * Requirements: All
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsForgeDatabaseClient } from '@/lib/insforge/types';

// Service imports
import { createAuthService } from '@/lib/auth/auth-service';
import { createWorkspaceService } from '@/lib/workspaces/workspace-service';
import { createDataSourceService } from '@/lib/data-sources/data-source-service';
import { createSemanticLayerService } from '@/lib/semantic/semantic-layer-service';
import { createDashboardService } from '@/lib/dashboards/dashboard-service';
import { createGovernanceEngine, checkDenylist, checkSelectOnly } from '@/lib/governance/governance-engine';
import { hasPermission, type Role } from '@/lib/rbac/rbac-middleware';
import { createVisualizationService } from '@/lib/visualization/visualization-service';

// --- Mock InsForge Factory ---

function createMockInsForge(overrides?: {
  authUser?: { id: string; email: string } | null;
  authError?: { message: string } | null;
  tables?: Record<string, unknown[]>;
  rpcResult?: { data: unknown; error: unknown };
}): InsForgeDatabaseClient {
  const tables = overrides?.tables ?? {};
  const insertedRows: Record<string, unknown[]> = {};

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const tableData = tables[table] ?? [];

    const chainable = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: tableData[0] ?? null, error: null }),
            data: tableData,
            error: null,
          }),
          single: vi.fn().mockResolvedValue({ data: tableData[0] ?? null, error: null }),
          order: vi.fn().mockResolvedValue({ data: tableData, error: null }),
          in: vi.fn().mockResolvedValue({ data: tableData, error: null }),
          data: tableData,
          error: null,
        }),
        in: vi.fn().mockResolvedValue({ data: tableData, error: null }),
        order: vi.fn().mockReturnValue({
          data: tableData,
          error: null,
        }),
        single: vi.fn().mockResolvedValue({ data: tableData[0] ?? null, error: null }),
      }),
      insert: vi.fn().mockImplementation((row: unknown) => {
        const rows = Array.isArray(row) ? row : [row];
        if (!insertedRows[table]) insertedRows[table] = [];
        insertedRows[table].push(...rows);

        const insertResult = rows.map((r, i) => ({
          id: `${table}-${Date.now()}-${i}`,
          ...r,
          created_at: new Date().toISOString(),
        }));

        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertResult[0], error: null }),
            data: insertResult,
            error: null,
          }),
          data: insertResult,
          error: null,
        };
      }),
      update: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: tableData[0] ?? null, error: null }),
            }),
            data: null,
            error: null,
          }),
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: tableData[0] ?? null, error: null }),
          }),
          data: null,
          error: null,
        }),
      })),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          data: null,
          error: null,
        }),
      }),
    };

    return chainable;
  });

  const mockAuth = {
    signUp: vi.fn().mockResolvedValue({
      data: {
        user: overrides?.authUser ?? { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'token-123' },
      },
      error: overrides?.authError ?? null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: {
        user: overrides?.authUser ?? { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'token-123' },
      },
      error: overrides?.authError ?? null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token-123', user: overrides?.authUser ?? { id: 'user-1' } } },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: overrides?.authUser ?? { id: 'user-1', email: 'test@example.com' } },
      error: null,
    }),
  };

  const mockRpc = vi.fn().mockResolvedValue(
    overrides?.rpcResult ?? { data: [{ count: 42 }], error: null }
  );

  return {
    from: mockFrom,
    auth: mockAuth,
    rpc: mockRpc,
    _insertedRows: insertedRows,
  } as unknown as InsForgeDatabaseClient;
}

// =============================================================================
// TEST SUITE 1: Full Pipeline Integration
// =============================================================================

describe('E2E: Full Pipeline - Question to Dashboard', () => {
  let insforge: InsForgeDatabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    insforge = createMockInsForge({
      authUser: { id: 'user-1', email: 'analyst@company.com' },
      tables: {
        workspaces: [{ id: 'ws-1', name: 'Test Workspace', owner_id: 'user-1', created_at: '2024-01-01' }],
        workspace_members: [{ id: 'mem-1', workspace_id: 'ws-1', user_id: 'user-1', role: 'owner', invited_at: '2024-01-01' }],
        data_sources: [{ id: 'ds-1', workspace_id: 'ws-1', name: 'sales.csv', type: 'csv', status: 'ready', row_count: 100, file_size_bytes: 1024, created_at: '2024-01-01' }],
        semantic_entities: [{ id: 'e-1', workspace_id: 'ws-1', data_source_id: 'ds-1', name: 'Sales', description: 'Sales data', created_at: '2024-01-01' }],
        metrics: [{ id: 'm-1', workspace_id: 'ws-1', name: 'MRR', description: 'Monthly Recurring Revenue', formula: 'SUM(amount)', certified: true, certified_by: 'user-1', certified_at: '2024-01-01', created_at: '2024-01-01', created_by: 'user-1' }],
        dashboards: [{ id: 'dash-1', workspace_id: 'ws-1', name: 'Revenue Dashboard', description: null, created_by: 'user-1', created_at: '2024-01-01' }],
        widgets: [],
      },
    });
  });

  it('should sign up a new user successfully', async () => {
    const authService = createAuthService(insforge);
    const result = await authService.signUp('new@company.com', 'securepass123');

    expect(result.user).not.toBeNull();
    expect(result.user?.id).toBe('user-1');
    expect(result.error).toBeNull();
  });

  it('should create a workspace and assign owner role', async () => {
    const workspaceService = createWorkspaceService(insforge);
    const workspace = await workspaceService.create('Analytics Team', 'user-1');

    expect(workspace).toBeDefined();
    expect(workspace.name).toBe('Analytics Team');
    // Verify workspace_members insert was called (owner role assignment)
    expect(insforge.from).toHaveBeenCalledWith('workspace_members');
  });

  it('should create a semantic entity from a data source', async () => {
    const semanticService = createSemanticLayerService(insforge);
    const entity = await semanticService.createEntity('ws-1', {
      name: 'Customers',
      dataSourceId: 'ds-1',
      description: 'Customer records',
    });

    expect(entity).toBeDefined();
    expect(entity.name).toBe('Customers');
    expect(insforge.from).toHaveBeenCalledWith('semantic_entities');
  });

  it('should recommend a chart type based on query results', () => {
    const vizService = createVisualizationService();

    // Time series data → line chart
    const timeSeriesResult = {
      columns: [
        { name: 'month', type: 'date' },
        { name: 'revenue', type: 'float' },
      ],
      rows: [
        { month: '2024-01', revenue: 10000 },
        { month: '2024-02', revenue: 12000 },
        { month: '2024-03', revenue: 15000 },
      ],
      rowCount: 3,
    };

    const recommendation = vizService.recommendChart(timeSeriesResult);
    expect(recommendation.type).toBe('line');
  });

  it('should recommend KPI card for single numeric value', () => {
    const vizService = createVisualizationService();

    const singleValueResult = {
      columns: [{ name: 'total_revenue', type: 'float' }],
      rows: [{ total_revenue: 150000 }],
      rowCount: 1,
    };

    const recommendation = vizService.recommendChart(singleValueResult);
    expect(recommendation.type).toBe('kpi');
  });

  it('should save an insight to a dashboard', async () => {
    const dashboardService = createDashboardService(insforge);

    const widget = await dashboardService.saveInsight('dash-1', {
      question: 'What is our MRR?',
      sql: "SELECT SUM(amount) AS mrr FROM subscriptions WHERE status = 'active'",
      resultData: [{ mrr: 150000 }],
      chartConfig: { type: 'kpi', data: [], xAxis: {}, yAxis: {}, series: [], legend: false },
      summary: 'Your current MRR is $150,000',
      citations: [{ type: 'metric', name: 'MRR', id: 'm-1' }],
      confidence: 0.92,
      assumptions: ['Only active subscriptions counted'],
    });

    expect(widget).toBeDefined();
    expect(widget.type).toBe('insight_card');
    expect(insforge.from).toHaveBeenCalledWith('widgets');
  });

  it('should create a dashboard and add widgets', async () => {
    const dashboardService = createDashboardService(insforge);

    const dashboard = await dashboardService.create('ws-1', {
      name: 'Executive Overview',
      description: 'Key metrics at a glance',
      createdBy: 'user-1',
    });

    expect(dashboard).toBeDefined();
    expect(dashboard.name).toBe('Executive Overview');

    const widget = await dashboardService.addWidget(dashboard.id, {
      type: 'chart',
      config: { type: 'bar', data: [] },
      position: { x: 0, y: 0, w: 6, h: 4 },
    });

    expect(widget).toBeDefined();
    expect(widget.type).toBe('chart');
  });
});

// =============================================================================
// TEST SUITE 2: Role-Based Access Control
// =============================================================================

describe('E2E: Role-Based Access Restrictions', () => {
  it('should enforce role hierarchy: owner > admin > analyst > viewer', () => {
    // Owner can do everything
    expect(hasPermission('owner', 'owner')).toBe(true);
    expect(hasPermission('owner', 'admin')).toBe(true);
    expect(hasPermission('owner', 'analyst')).toBe(true);
    expect(hasPermission('owner', 'viewer')).toBe(true);

    // Admin cannot do owner actions
    expect(hasPermission('admin', 'owner')).toBe(false);
    expect(hasPermission('admin', 'admin')).toBe(true);
    expect(hasPermission('admin', 'analyst')).toBe(true);
    expect(hasPermission('admin', 'viewer')).toBe(true);

    // Analyst cannot do admin or owner actions
    expect(hasPermission('analyst', 'owner')).toBe(false);
    expect(hasPermission('analyst', 'admin')).toBe(false);
    expect(hasPermission('analyst', 'analyst')).toBe(true);
    expect(hasPermission('analyst', 'viewer')).toBe(true);

    // Viewer can only view
    expect(hasPermission('viewer', 'owner')).toBe(false);
    expect(hasPermission('viewer', 'admin')).toBe(false);
    expect(hasPermission('viewer', 'analyst')).toBe(false);
    expect(hasPermission('viewer', 'viewer')).toBe(true);
  });

  it('should deny viewer from creating entities (requires analyst+)', () => {
    const viewerRole: Role = 'viewer';
    const requiredRole: Role = 'analyst';

    expect(hasPermission(viewerRole, requiredRole)).toBe(false);
  });

  it('should deny analyst from certifying metrics (requires admin+)', () => {
    const analystRole: Role = 'analyst';
    const requiredRole: Role = 'admin';

    expect(hasPermission(analystRole, requiredRole)).toBe(false);
  });

  it('should allow admin to manage data sources (requires analyst+)', () => {
    const adminRole: Role = 'admin';
    const requiredRole: Role = 'analyst';

    expect(hasPermission(adminRole, requiredRole)).toBe(true);
  });

  it('should deny viewer from creating dashboards (requires analyst+)', () => {
    const viewerRole: Role = 'viewer';
    const requiredRole: Role = 'analyst';

    expect(hasPermission(viewerRole, requiredRole)).toBe(false);
  });

  it('should allow viewer to ask questions (requires viewer+)', () => {
    const viewerRole: Role = 'viewer';
    const requiredRole: Role = 'viewer';

    expect(hasPermission(viewerRole, requiredRole)).toBe(true);
  });
});

// =============================================================================
// TEST SUITE 3: Governance Engine Blocks Dangerous Queries
// =============================================================================

describe('E2E: Governance Engine - Dangerous Query Blocking', () => {
  it('should block DROP TABLE statements', () => {
    const errors = checkDenylist('DROP TABLE customers');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe('DENIED_KEYWORD');
  });

  it('should block DELETE FROM statements', () => {
    const errors = checkDenylist('DELETE FROM customers WHERE id = 1');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('DELETE'))).toBe(true);
  });

  it('should block INSERT INTO statements', () => {
    const errors = checkDenylist("INSERT INTO customers (name) VALUES ('hacker')");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('INSERT'))).toBe(true);
  });

  it('should block UPDATE statements', () => {
    const errors = checkDenylist("UPDATE customers SET email = 'hacked@evil.com'");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('UPDATE'))).toBe(true);
  });

  it('should block ALTER TABLE statements', () => {
    const errors = checkDenylist('ALTER TABLE customers DROP COLUMN email');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('ALTER'))).toBe(true);
  });

  it('should block TRUNCATE statements', () => {
    const errors = checkDenylist('TRUNCATE TABLE customers');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('TRUNCATE'))).toBe(true);
  });

  it('should only allow SELECT statements', () => {
    const selectErrors = checkSelectOnly('SELECT COUNT(*) FROM customers');
    expect(selectErrors).toHaveLength(0);

    const insertErrors = checkSelectOnly("INSERT INTO customers VALUES (1, 'test')");
    expect(insertErrors.length).toBeGreaterThan(0);
    expect(insertErrors[0].code).toBe('NOT_SELECT');
  });

  it('should validate SQL through the full governance engine', async () => {
    const insforge = createMockInsForge({
      tables: {
        sql_policies: [],
        audit_events: [],
      },
    });
    const engine = createGovernanceEngine(insforge);

    // Valid SELECT should pass
    const validResult = await engine.validateSQL(
      "SELECT COUNT(*) FROM customers WHERE status = 'active'",
      {
        workspaceId: 'ws-1',
        allowedTables: ['customers', 'subscriptions'],
        allowedColumns: ['id', 'status', 'name'],
        denyPatterns: [],
      }
    );
    expect(validResult.valid).toBe(true);

    // DROP should fail
    const dropResult = await engine.validateSQL(
      'DROP TABLE customers',
      {
        workspaceId: 'ws-1',
        allowedTables: ['customers'],
        allowedColumns: ['id'],
        denyPatterns: [],
      }
    );
    expect(dropResult.valid).toBe(false);
    expect(dropResult.errors.some(e => e.code === 'DENIED_KEYWORD')).toBe(true);
  });
});
