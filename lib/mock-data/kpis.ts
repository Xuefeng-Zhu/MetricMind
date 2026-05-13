import type { KPIMetric } from './types';

// ─── Home Page KPIs ─────────────────────────────────────────────────────────

export const homeKPIs: KPIMetric[] = [
  {
    id: 'home-mrr',
    label: 'MRR',
    value: '$428.6k',
    numericValue: 428600,
    trend: 'up',
    trendValue: '+12.3%',
    trendPercentage: 12.3,
  },
  {
    id: 'home-nrr',
    label: 'NRR',
    value: '118%',
    numericValue: 118,
    trend: 'up',
    trendValue: '+2.1%',
    trendPercentage: 2.1,
  },
  {
    id: 'home-churn-risk',
    label: 'Churn Risk',
    value: '37',
    numericValue: 37,
    trend: 'down',
    trendValue: '-5',
    trendPercentage: -5,
  },
  {
    id: 'home-ai-questions',
    label: 'AI Questions',
    value: '1,284',
    numericValue: 1284,
    trend: 'up',
    trendValue: '+18.7%',
    trendPercentage: 18.7,
  },
];

// ─── Executive Dashboard KPIs ───────────────────────────────────────────────

export const executiveKPIs: KPIMetric[] = [
  {
    id: 'exec-mrr',
    label: 'MRR',
    value: '$428.6k',
    numericValue: 428600,
    trend: 'up',
    trendValue: '+12.3%',
    trendPercentage: 12.3,
  },
  {
    id: 'exec-arr',
    label: 'ARR',
    value: '$5.14M',
    numericValue: 5140000,
    trend: 'up',
    trendValue: '+14.1%',
    trendPercentage: 14.1,
  },
  {
    id: 'exec-active-users',
    label: 'Active Users',
    value: '42.8k',
    numericValue: 42800,
    trend: 'up',
    trendValue: '+8.2%',
    trendPercentage: 8.2,
  },
  {
    id: 'exec-churn-rate',
    label: 'Churn Rate',
    value: '4.9%',
    numericValue: 4.9,
    trend: 'down',
    trendValue: '-0.3%',
    trendPercentage: -0.3,
  },
];

// ─── Audit Page KPIs ────────────────────────────────────────────────────────

export const auditKPIs: KPIMetric[] = [
  {
    id: 'audit-blocked-sql',
    label: 'Blocked SQL',
    value: '18',
    numericValue: 18,
    trend: 'down',
    trendValue: '-3',
    trendPercentage: -14.3,
  },
  {
    id: 'audit-ai-traces',
    label: 'AI Traces',
    value: '6.2k',
    numericValue: 6200,
    trend: 'up',
    trendValue: '+12.4%',
    trendPercentage: 12.4,
  },
  {
    id: 'audit-rls-checks',
    label: 'RLS Policy Checks',
    value: '42k',
    numericValue: 42000,
    trend: 'up',
    trendValue: '+5.8%',
    trendPercentage: 5.8,
  },
  {
    id: 'audit-pii-columns',
    label: 'PII Columns',
    value: '12',
    numericValue: 12,
    trend: 'neutral',
    trendValue: '0',
    trendPercentage: 0,
  },
];
