import type { RevenueDataPoint, WeeklyActiveUsers } from './types';

// ─── Revenue Time Series (12 months) ───────────────────────────────────────

export const revenueTimeSeries: RevenueDataPoint[] = [
  {
    month: 'Jan 2024',
    mrr: 312000,
    arr: 3744000,
    starter: 46800,
    growth: 140400,
    enterprise: 124800,
  },
  {
    month: 'Feb 2024',
    mrr: 325000,
    arr: 3900000,
    starter: 48750,
    growth: 146250,
    enterprise: 130000,
  },
  {
    month: 'Mar 2024',
    mrr: 341000,
    arr: 4092000,
    starter: 51150,
    growth: 153450,
    enterprise: 136400,
  },
  {
    month: 'Apr 2024',
    mrr: 352000,
    arr: 4224000,
    starter: 52800,
    growth: 158400,
    enterprise: 140800,
  },
  {
    month: 'May 2024',
    mrr: 368000,
    arr: 4416000,
    starter: 55200,
    growth: 165600,
    enterprise: 147200,
  },
  {
    month: 'Jun 2024',
    mrr: 379000,
    arr: 4548000,
    starter: 56850,
    growth: 170550,
    enterprise: 151600,
  },
  {
    month: 'Jul 2024',
    mrr: 388000,
    arr: 4656000,
    starter: 58200,
    growth: 174600,
    enterprise: 155200,
  },
  {
    month: 'Aug 2024',
    mrr: 396000,
    arr: 4752000,
    starter: 59400,
    growth: 178200,
    enterprise: 158400,
  },
  {
    month: 'Sep 2024',
    mrr: 405000,
    arr: 4860000,
    starter: 60750,
    growth: 182250,
    enterprise: 162000,
  },
  {
    month: 'Oct 2024',
    mrr: 412000,
    arr: 4944000,
    starter: 61800,
    growth: 185400,
    enterprise: 164800,
  },
  {
    month: 'Nov 2024',
    mrr: 421000,
    arr: 5052000,
    starter: 63150,
    growth: 189450,
    enterprise: 168400,
  },
  {
    month: 'Dec 2024',
    mrr: 428600,
    arr: 5143200,
    starter: 64290,
    growth: 192870,
    enterprise: 171440,
  },
];

// ─── Weekly Active Users (8 weeks) ─────────────────────────────────────────

export const weeklyActiveUsers: WeeklyActiveUsers[] = [
  { week: 'Week 1', current: 38200, previous: 35100 },
  { week: 'Week 2', current: 39100, previous: 35800 },
  { week: 'Week 3', current: 39800, previous: 36400 },
  { week: 'Week 4', current: 40500, previous: 37200 },
  { week: 'Week 5', current: 41200, previous: 37900 },
  { week: 'Week 6', current: 41800, previous: 38500 },
  { week: 'Week 7', current: 42300, previous: 39100 },
  { week: 'Week 8', current: 42800, previous: 39600 },
];
