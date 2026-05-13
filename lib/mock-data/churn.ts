import type { ChurnCohort, ChurnDriver, AtRiskAccount } from './types';

// ─── Churn by Activation Cohort ─────────────────────────────────────────────

export const churnByCohort: ChurnCohort[] = [
  { cohort: 'Jan 2024', churnRate: 5.2, count: 142 },
  { cohort: 'Feb 2024', churnRate: 4.8, count: 158 },
  { cohort: 'Mar 2024', churnRate: 6.1, count: 134 },
  { cohort: 'Apr 2024', churnRate: 7.4, count: 121 },
  { cohort: 'May 2024', churnRate: 5.9, count: 147 },
  { cohort: 'Jun 2024', churnRate: 4.3, count: 163 },
];

// ─── Churn Drivers ──────────────────────────────────────────────────────────

export const churnDrivers: ChurnDriver[] = [
  { name: 'Onboarding Friction', percentage: 34, value: 34 },
  { name: 'Support Response Time', percentage: 28, value: 28 },
  { name: 'Feature Gap', percentage: 22, value: 22 },
  { name: 'Pricing', percentage: 16, value: 16 },
];

// ─── At-Risk Accounts ───────────────────────────────────────────────────────

export const atRiskAccounts: AtRiskAccount[] = [
  {
    name: 'TechFlow Inc',
    mrr: 18400,
    riskScore: 92,
    daysSinceEngagement: 34,
    status: 'critical',
  },
  {
    name: 'DataVault Systems',
    mrr: 14200,
    riskScore: 87,
    daysSinceEngagement: 28,
    status: 'critical',
  },
  {
    name: 'CloudNine Analytics',
    mrr: 21600,
    riskScore: 74,
    daysSinceEngagement: 21,
    status: 'warning',
  },
  {
    name: 'Nexus Platforms',
    mrr: 9800,
    riskScore: 68,
    daysSinceEngagement: 18,
    status: 'warning',
  },
  {
    name: 'Streamline Corp',
    mrr: 12400,
    riskScore: 55,
    daysSinceEngagement: 14,
    status: 'monitoring',
  },
];
