import type { CertifiedMetric } from './types';

// ─── Dashboard Interfaces ───────────────────────────────────────────────────

export interface PlanMixItem {
  plan: string;
  revenue: number;
  percentage: number;
}

export interface AIInsight {
  summary: string;
  confidence: number;
  link: string;
}

export interface RecentMetric {
  name: string;
  owner: string;
  date: string;
  status: 'certified' | 'pending' | 'draft';
}

export interface TrustHealthItem {
  label: string;
  value: number;
}

// ─── Plan Mix ───────────────────────────────────────────────────────────────

export const planMix: PlanMixItem[] = [
  { plan: 'Starter', revenue: 64300, percentage: 15 },
  { plan: 'Growth', revenue: 192900, percentage: 45 },
  { plan: 'Enterprise', revenue: 171400, percentage: 40 },
];

// ─── AI Insight ─────────────────────────────────────────────────────────────

export const aiInsight: AIInsight = {
  summary: 'Enterprise churn spiked 58% above expected range',
  confidence: 91,
  link: '/app/insights/churn-spike',
};

// ─── Recently Certified Metrics ─────────────────────────────────────────────

export const recentMetrics: RecentMetric[] = [
  {
    name: 'Monthly Recurring Revenue',
    owner: 'Sarah Chen',
    date: '2024-01-15',
    status: 'certified',
  },
  {
    name: 'Net Revenue Retention',
    owner: 'Marcus Johnson',
    date: '2024-01-12',
    status: 'certified',
  },
  {
    name: 'Customer Acquisition Cost',
    owner: 'Sarah Chen',
    date: '2024-01-10',
    status: 'certified',
  },
  {
    name: 'Average Revenue Per Account',
    owner: 'Priya Patel',
    date: '2024-01-08',
    status: 'pending',
  },
  {
    name: 'Expansion Revenue',
    owner: 'Marcus Johnson',
    date: '2024-01-05',
    status: 'certified',
  },
];

// ─── Trust Health ───────────────────────────────────────────────────────────

export const trustHealth: TrustHealthItem[] = [
  { label: 'SQL Safety', value: 97 },
  { label: 'Hallucination Rate', value: 0.3 },
  { label: 'Trace Coverage', value: 99.2 },
];

// ─── Suggested Questions ────────────────────────────────────────────────────

export const suggestedQuestions: string[] = [
  'Why did churn increase in April?',
  'MRR by plan',
  'Top expansion accounts',
  'Weekly active users',
  'Support ticket trends',
];
