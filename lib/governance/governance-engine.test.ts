import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  createGovernanceEngine,
  checkDenylist,
  checkSelectOnly,
  extractTableReferences,
  checkScope,
  checkAllowlist,
  checkCustomDenyPatterns,
  extractMetricReferences,
  GovernanceEngine,
  GovernanceContext,
  AIResponse,
} from './governance-engine';

// --- Mock Supabase ---

function createMockSupabase(options?: {
  policies?: { policy_type: string; pattern: string }[];
  metrics?: { name: string; formula: string; certified: boolean }[];
}): SupabaseClient {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const selectMock = vi.fn().mockImplementation(() => {
    return {
      eq: vi.fn().mockImplementation((field: string, value: string) => {
        if (field === 'workspace_id') {
          return {
            eq: vi.fn().mockImplementation((field2: string) => {
              if (field2 === 'enabled') {
                return Promise.resolve({ data: options?.policies || [], error: null });
              }
              return Promise.resolve({ data: options?.metrics || [], error: null });
            }),
          };
        }
        return {
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'audit_events') {
        return { insert: insertMock };
      }
      if (table === 'sql_policies') {
        return { select: selectMock };
      }
      if (table === 'metrics') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: options?.metrics || [],
              error: null,
            }),
          }),
        };
      }
      return { select: selectMock, insert: insertMock };
    }),
  } as unknown as SupabaseClient;
}

// --- Test Data ---

const defaultContext: GovernanceContext = {
  workspaceId: 'ws-test-123',
  allowedTables: ['customers', 'subscriptions', 'invoices'],
  allowedColumns: ['id', 'name', 'email', 'mrr', 'status'],
  denyPatterns: [],
};

describe('Governance Engine', () => {
  describe('checkDenylist', () => {
    it('rejects SQL containing DROP', () => {
      const errors = checkDenylist('DROP TABLE customers');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('DENIED_KEYWORD');
      expect(errors[0].message).toContain('DROP');
    });

    it('rejects SQL containing DELETE', () => {
      const errors = checkDenylist('DELETE FROM customers WHERE id = 1');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('DELETE');
    });

    it('rejects SQL containing UPDATE', () => {
      const errors = checkDenylist("UPDATE customers SET name = 'test'");
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('UPDATE');
    });

    it('rejects SQL containing INSERT', () => {
      const errors = checkDenylist("INSERT INTO customers VALUES (1, 'test')");
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('INSERT');
    });

    it('rejects SQL containing ALTER', () => {
      const errors = checkDenylist('ALTER TABLE customers ADD COLUMN age INT');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('ALTER');
    });

    it('rejects SQL containing TRUNCATE', () => {
      const errors = checkDenylist('TRUNCATE TABLE customers');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('TRUNCATE');
    });

    it('rejects SQL containing GRANT', () => {
      const errors = checkDenylist('GRANT ALL ON customers TO public');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('GRANT');
    });

    it('rejects SQL containing REVOKE', () => {
      const errors = checkDenylist('REVOKE ALL ON customers FROM public');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('REVOKE');
    });

    it('is case-insensitive', () => {
      const errors = checkDenylist('drop table customers');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('DROP');
    });

    it('uses word boundary matching (does not match substrings)', () => {
      // "updated_at" contains "update" but should not trigger
      const errors = checkDenylist('SELECT updated_at FROM customers');
      expect(errors).toHaveLength(0);
    });

    it('allows valid SELECT statements', () => {
      const errors = checkDenylist('SELECT COUNT(*) FROM customers WHERE status = \'active\'');
      expect(errors).toHaveLength(0);
    });

    it('detects multiple denied keywords', () => {
      const errors = checkDenylist('DROP TABLE customers; DELETE FROM invoices');
      expect(errors).toHaveLength(2);
    });
  });

  describe('checkSelectOnly', () => {
    it('allows SELECT statements', () => {
      const errors = checkSelectOnly('SELECT * FROM customers');
      expect(errors).toHaveLength(0);
    });

    it('allows SELECT with leading whitespace', () => {
      const errors = checkSelectOnly('  SELECT * FROM customers');
      expect(errors).toHaveLength(0);
    });

    it('allows SELECT with leading comments', () => {
      const errors = checkSelectOnly('-- comment\nSELECT * FROM customers');
      expect(errors).toHaveLength(0);
    });

    it('allows SELECT with block comments', () => {
      const errors = checkSelectOnly('/* block comment */ SELECT * FROM customers');
      expect(errors).toHaveLength(0);
    });

    it('rejects non-SELECT statements', () => {
      const errors = checkSelectOnly("INSERT INTO customers VALUES (1, 'test')");
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('NOT_SELECT');
    });

    it('rejects empty SQL', () => {
      const errors = checkSelectOnly('');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('NOT_SELECT');
    });

    it('is case-insensitive for SELECT', () => {
      const errors = checkSelectOnly('select * from customers');
      expect(errors).toHaveLength(0);
    });
  });

  describe('extractTableReferences', () => {
    it('extracts table from simple FROM clause', () => {
      const tables = extractTableReferences('SELECT * FROM customers');
      expect(tables).toContain('customers');
    });

    it('extracts table from JOIN clause', () => {
      const tables = extractTableReferences(
        'SELECT * FROM customers JOIN subscriptions ON customers.id = subscriptions.customer_id'
      );
      expect(tables).toContain('customers');
      expect(tables).toContain('subscriptions');
    });

    it('extracts multiple tables', () => {
      const tables = extractTableReferences(
        'SELECT * FROM customers c JOIN invoices i ON c.id = i.customer_id LEFT JOIN payments p ON i.id = p.invoice_id'
      );
      expect(tables).toContain('customers');
      expect(tables).toContain('invoices');
      expect(tables).toContain('payments');
    });

    it('handles schema-prefixed tables', () => {
      const tables = extractTableReferences('SELECT * FROM public.customers');
      expect(tables).toContain('public.customers');
    });

    it('is case-insensitive', () => {
      const tables = extractTableReferences('SELECT * FROM Customers');
      expect(tables).toContain('customers');
    });
  });

  describe('checkScope', () => {
    it('allows queries referencing only allowed tables', () => {
      const errors = checkScope(
        'SELECT * FROM customers JOIN subscriptions ON customers.id = subscriptions.customer_id',
        ['customers', 'subscriptions', 'invoices']
      );
      expect(errors).toHaveLength(0);
    });

    it('rejects queries referencing tables outside scope', () => {
      const errors = checkScope(
        'SELECT * FROM customers JOIN secret_data ON customers.id = secret_data.customer_id',
        ['customers', 'subscriptions']
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('OUT_OF_SCOPE');
      expect(errors[0].message).toContain('secret_data');
    });

    it('is case-insensitive for table matching', () => {
      const errors = checkScope(
        'SELECT * FROM CUSTOMERS',
        ['customers']
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('checkAllowlist', () => {
    it('returns no warnings when no allowlist is configured', () => {
      const warnings = checkAllowlist('SELECT * FROM customers', []);
      expect(warnings).toHaveLength(0);
    });

    it('returns no warnings when SQL matches an allowlist pattern', () => {
      const warnings = checkAllowlist(
        'SELECT * FROM customers',
        ['SELECT.*FROM\\s+customers']
      );
      expect(warnings).toHaveLength(0);
    });

    it('returns warning when SQL does not match any allowlist pattern', () => {
      const warnings = checkAllowlist(
        'SELECT * FROM secret_table',
        ['SELECT.*FROM\\s+customers', 'SELECT.*FROM\\s+invoices']
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('ALLOWLIST_MISMATCH');
    });

    it('handles invalid regex patterns gracefully', () => {
      const warnings = checkAllowlist(
        'SELECT * FROM customers',
        ['[invalid regex']
      );
      // Invalid pattern is skipped, so SQL doesn't match any valid pattern
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('ALLOWLIST_MISMATCH');
    });
  });

  describe('checkCustomDenyPatterns', () => {
    it('returns no errors when no patterns match', () => {
      const errors = checkCustomDenyPatterns(
        'SELECT * FROM customers',
        [/DANGEROUS_FUNCTION/i]
      );
      expect(errors).toHaveLength(0);
    });

    it('returns errors when a pattern matches', () => {
      const errors = checkCustomDenyPatterns(
        'SELECT DANGEROUS_FUNCTION() FROM customers',
        [/DANGEROUS_FUNCTION/i]
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('CUSTOM_DENY_PATTERN');
    });
  });

  describe('extractMetricReferences', () => {
    it('finds metric names in SQL', () => {
      const refs = extractMetricReferences(
        'SELECT SUM(mrr_cents)/100 AS MRR FROM subscriptions',
        ['MRR', 'ARR', 'Churn Rate']
      );
      expect(refs).toContain('MRR');
    });

    it('is case-insensitive', () => {
      const refs = extractMetricReferences(
        'SELECT sum(mrr_cents)/100 AS mrr FROM subscriptions',
        ['MRR']
      );
      expect(refs).toContain('MRR');
    });

    it('returns empty array when no metrics match', () => {
      const refs = extractMetricReferences(
        'SELECT COUNT(*) FROM customers',
        ['MRR', 'ARR']
      );
      expect(refs).toHaveLength(0);
    });

    it('handles metric names with spaces', () => {
      const refs = extractMetricReferences(
        'SELECT churned/total AS "Churn Rate" FROM metrics_view',
        ['Churn Rate']
      );
      expect(refs).toContain('Churn Rate');
    });
  });

  describe('validateSQL (integration)', () => {
    let engine: GovernanceEngine;
    let supabase: SupabaseClient;

    beforeEach(() => {
      supabase = createMockSupabase();
      engine = createGovernanceEngine(supabase);
    });

    it('validates a clean SELECT query', async () => {
      const result = await engine.validateSQL(
        'SELECT COUNT(*) FROM customers WHERE status = \'active\'',
        defaultContext
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a DROP statement', async () => {
      const result = await engine.validateSQL(
        'DROP TABLE customers',
        defaultContext
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DENIED_KEYWORD')).toBe(true);
      expect(result.errors.some((e) => e.code === 'NOT_SELECT')).toBe(true);
    });

    it('rejects queries referencing out-of-scope tables', async () => {
      const result = await engine.validateSQL(
        'SELECT * FROM secret_data',
        defaultContext
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'OUT_OF_SCOPE')).toBe(true);
    });

    it('logs security event on rejection', async () => {
      await engine.validateSQL('DROP TABLE customers', defaultContext);

      expect(supabase.from).toHaveBeenCalledWith('audit_events');
    });

    it('rejects non-SELECT statements', async () => {
      const result = await engine.validateSQL(
        "INSERT INTO customers VALUES (1, 'test')",
        defaultContext
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NOT_SELECT')).toBe(true);
    });
  });

  describe('checkMetricReferences', () => {
    it('validates SQL with known metrics', async () => {
      const supabase = createMockSupabase({
        metrics: [
          { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
          { name: 'ARR', formula: 'MRR * 12', certified: true },
        ],
      });
      const engine = createGovernanceEngine(supabase);

      const result = await engine.checkMetricReferences(
        'SELECT SUM(mrr_cents)/100 AS MRR FROM subscriptions',
        'ws-test-123'
      );

      expect(result.referencedMetrics).toContain('MRR');
    });

    it('returns valid when all metrics are known', async () => {
      const supabase = createMockSupabase({
        metrics: [
          { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
        ],
      });
      const engine = createGovernanceEngine(supabase);

      const result = await engine.checkMetricReferences(
        'SELECT SUM(mrr_cents)/100 AS total FROM subscriptions',
        'ws-test-123'
      );

      expect(result.valid).toBe(true);
      expect(result.unverifiedMetrics).toHaveLength(0);
    });
  });

  describe('flagHallucination', () => {
    it('flags citations referencing non-existent metrics', async () => {
      const supabase = createMockSupabase({
        metrics: [
          { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
        ],
      });
      const engine = createGovernanceEngine(supabase);

      const response: AIResponse = {
        sql: 'SELECT SUM(mrr_cents)/100 AS MRR FROM subscriptions',
        confidence: 0.85,
        citations: [
          { type: 'metric', name: 'MRR', id: 'met-1' },
          { type: 'metric', name: 'Fake Metric', id: 'met-fake' },
        ],
        assumptions: [],
      };

      const result = await engine.flagHallucination(response, 'ws-test-123');

      expect(result.flagged).toBe(true);
      expect(result.issues.some((i) => i.type === 'unverified_metric' && i.metricName === 'Fake Metric')).toBe(true);
    });

    it('does not flag when all cited metrics exist', async () => {
      const supabase = createMockSupabase({
        metrics: [
          { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
          { name: 'ARR', formula: 'MRR * 12', certified: true },
        ],
      });
      const engine = createGovernanceEngine(supabase);

      const response: AIResponse = {
        sql: 'SELECT SUM(mrr_cents)/100 AS MRR FROM subscriptions',
        confidence: 0.9,
        citations: [
          { type: 'metric', name: 'MRR', id: 'met-1' },
        ],
        assumptions: [],
      };

      const result = await engine.flagHallucination(response, 'ws-test-123');

      expect(result.flagged).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it('detects calculation mismatches against certified definitions', async () => {
      const supabase = createMockSupabase({
        metrics: [
          { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
        ],
      });
      const engine = createGovernanceEngine(supabase);

      const response: AIResponse = {
        sql: 'SELECT AVG(mrr_cents) AS MRR FROM subscriptions',
        confidence: 0.8,
        citations: [
          { type: 'metric', name: 'MRR', id: 'met-1' },
        ],
        assumptions: [],
      };

      const result = await engine.flagHallucination(response, 'ws-test-123');

      expect(result.flagged).toBe(true);
      expect(result.issues.some((i) => i.type === 'calculation_mismatch')).toBe(true);
    });

    it('logs security event when hallucination is detected', async () => {
      const supabase = createMockSupabase({
        metrics: [],
      });
      const engine = createGovernanceEngine(supabase);

      const response: AIResponse = {
        sql: 'SELECT 1',
        confidence: 0.5,
        citations: [
          { type: 'metric', name: 'NonExistent', id: 'met-fake' },
        ],
        assumptions: [],
      };

      await engine.flagHallucination(response, 'ws-test-123');

      expect(supabase.from).toHaveBeenCalledWith('audit_events');
    });
  });
});
