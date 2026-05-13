import type { Conversation, AIAnswer } from './types';

// ─── Past Conversations ─────────────────────────────────────────────────────

export const conversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Why did churn increase in April?',
    lastMessage: 'The primary driver was onboarding friction affecting 34% of churned accounts...',
    timestamp: '2024-04-18T14:32:00Z',
  },
  {
    id: 'conv-2',
    title: 'MRR breakdown by plan',
    lastMessage: 'Enterprise accounts contribute 52% of total MRR at $222.9k...',
    timestamp: '2024-04-17T09:15:00Z',
  },
  {
    id: 'conv-3',
    title: 'Top expansion accounts this quarter',
    lastMessage: 'CloudScale Pro led with $4,200 expansion MRR, a 42% increase...',
    timestamp: '2024-04-15T16:48:00Z',
  },
  {
    id: 'conv-4',
    title: 'Weekly active user trends',
    lastMessage: 'WAU grew 8.2% week-over-week, driven by the new onboarding flow...',
    timestamp: '2024-04-12T11:22:00Z',
  },
  {
    id: 'conv-5',
    title: 'Support ticket resolution times',
    lastMessage: 'Average resolution time improved to 4.2 hours, down from 6.8 hours...',
    timestamp: '2024-04-10T08:05:00Z',
  },
];

// ─── Mock AI Answer ─────────────────────────────────────────────────────────

export const mockAnswer: AIAnswer = {
  question: 'Why did churn increase in April?',
  confidence: 92,
  summary:
    'April churn spiked to 7.4% primarily due to onboarding friction in the Jan–Feb 2024 cohorts. Customers who experienced more than 3 failed integration attempts in their first week were 3.4x more likely to churn. Secondary factors include slower support response times (avg 18hrs vs 6hr SLA) and a feature gap in the reporting module that affected 22% of churned accounts. The pricing tier change announced in March also contributed, with 16% of churned customers citing cost as their primary reason.',
  metrics: [
    { label: 'Churn Rate', value: '4.9%', trend: 'up' },
    { label: 'At-Risk MRR', value: '$74.2k', trend: 'up' },
    { label: 'Driver Strength', value: '3.4x', trend: 'up' },
  ],
  chartData: [
    { cohort: 'Jan 2024', churnRate: 5.2, count: 142 },
    { cohort: 'Feb 2024', churnRate: 4.8, count: 158 },
    { cohort: 'Mar 2024', churnRate: 6.1, count: 134 },
    { cohort: 'Apr 2024', churnRate: 7.4, count: 121 },
    { cohort: 'May 2024', churnRate: 5.9, count: 147 },
    { cohort: 'Jun 2024', churnRate: 4.3, count: 163 },
  ],
  citations: [
    { label: 'Churn Rate (Certified Metric)', source: '/app/semantic-layer/metrics/churn_rate' },
    { label: 'Onboarding Funnel Analysis', source: '/app/dashboards/executive' },
    { label: 'Support SLA Report — April 2024', source: '/app/data-sources/support-tickets' },
    { label: 'Pricing Change Impact Study', source: '/app/insights/churn-spike' },
  ],
  traceSteps: [
    'Parse intent',
    'Retrieve context',
    'Generate SQL',
    'Validate query',
    'Execute query',
    'Visualize results',
  ],
  nextQuestions: [
    'Which accounts are most at risk of churning next month?',
    'How does onboarding friction compare across plans?',
    'What was the support response time trend over the last 90 days?',
  ],
  sql: `SELECT
  c.cohort_month AS cohort,
  COUNT(CASE WHEN c.status = 'churned' THEN 1 END)::float
    / COUNT(*)::float * 100 AS churn_rate,
  COUNT(*) AS total_customers
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id
WHERE c.cohort_month >= '2024-01-01'
  AND c.cohort_month < '2024-07-01'
  AND s.status IN ('active', 'churned')
GROUP BY c.cohort_month
ORDER BY c.cohort_month;`,
};
