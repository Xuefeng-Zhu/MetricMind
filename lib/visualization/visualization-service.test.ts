import { describe, it, expect } from 'vitest';
import {
  createVisualizationService,
  QueryResultData,
  VisualizationService,
} from './visualization-service';

describe('VisualizationService', () => {
  let service: VisualizationService;

  beforeEach(() => {
    service = createVisualizationService();
  });

  describe('recommendChart', () => {
    it('should recommend KPI card for single row with single numeric column', () => {
      const data: QueryResultData = {
        columns: [{ name: 'total_revenue', type: 'float' }],
        rows: [{ total_revenue: 125000.5 }],
        rowCount: 1,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('kpi');
      expect(result.reason).toContain('Single numeric value');
      expect(result.axes.y).toBe('total_revenue');
    });

    it('should recommend line chart for time-based dimension with single measure', () => {
      const data: QueryResultData = {
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

      const result = service.recommendChart(data);

      expect(result.type).toBe('line');
      expect(result.axes.x).toBe('month');
      expect(result.axes.y).toBe('revenue');
    });

    it('should recommend area chart for time-based dimension with multiple measures', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'date', type: 'timestamp' },
          { name: 'revenue', type: 'float' },
          { name: 'expenses', type: 'float' },
        ],
        rows: [
          { date: '2024-01-01', revenue: 10000, expenses: 8000 },
          { date: '2024-02-01', revenue: 12000, expenses: 9000 },
        ],
        rowCount: 2,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('area');
      expect(result.axes.x).toBe('date');
      expect(result.axes.y).toBe('revenue');
      expect(result.reason).toContain('multiple measures');
    });

    it('should recommend pie chart for categorical dimension with single measure and ≤ 8 categories', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'plan', type: 'text' },
          { name: 'count', type: 'integer' },
        ],
        rows: [
          { plan: 'Basic', count: 100 },
          { plan: 'Pro', count: 250 },
          { plan: 'Enterprise', count: 50 },
        ],
        rowCount: 3,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('pie');
      expect(result.axes.x).toBe('plan');
      expect(result.axes.y).toBe('count');
    });

    it('should recommend bar chart for categorical dimension with single measure and > 8 categories', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'country', type: 'text' },
          { name: 'users', type: 'integer' },
        ],
        rows: Array.from({ length: 10 }, (_, i) => ({
          country: `Country_${i}`,
          users: (i + 1) * 100,
        })),
        rowCount: 10,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('bar');
      expect(result.axes.x).toBe('country');
      expect(result.axes.y).toBe('users');
    });

    it('should recommend scatter chart for two numeric columns with no dimension', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'height', type: 'float' },
          { name: 'weight', type: 'float' },
        ],
        rows: [
          { height: 170, weight: 65 },
          { height: 180, weight: 80 },
          { height: 160, weight: 55 },
        ],
        rowCount: 3,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('scatter');
      expect(result.axes.x).toBe('height');
      expect(result.axes.y).toBe('weight');
    });

    it('should recommend table as fallback for complex data shapes', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
          { name: 'email', type: 'text' },
        ],
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com' },
          { id: '2', name: 'Bob', email: 'bob@example.com' },
        ],
        rowCount: 2,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('table');
    });

    it('should recommend table for empty data', () => {
      const data: QueryResultData = {
        columns: [],
        rows: [],
        rowCount: 0,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('table');
      expect(result.reason).toContain('No data');
    });

    it('should handle timestamp type as time-based', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'created_at', type: 'timestamp' },
          { name: 'active_users', type: 'integer' },
        ],
        rows: [
          { created_at: '2024-01-01T00:00:00Z', active_users: 500 },
          { created_at: '2024-01-02T00:00:00Z', active_users: 520 },
        ],
        rowCount: 2,
      };

      const result = service.recommendChart(data);

      expect(result.type).toBe('line');
      expect(result.axes.x).toBe('created_at');
    });
  });

  describe('getChartConfig', () => {
    it('should generate KPI config with value and label', () => {
      const data: QueryResultData = {
        columns: [{ name: 'total_revenue', type: 'float' }],
        rows: [{ total_revenue: 125000.5 }],
        rowCount: 1,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('kpi');
      expect(config.data).toEqual(data.rows);
      expect(config.yAxis.dataKey).toBe('total_revenue');
      expect(config.yAxis.label).toBe('Total Revenue');
      expect(config.legend).toBe(false);
      expect(config.series).toHaveLength(1);
      expect(config.series[0].dataKey).toBe('total_revenue');
    });

    it('should generate line chart config with proper axes and series', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'month', type: 'date' },
          { name: 'revenue', type: 'float' },
        ],
        rows: [
          { month: '2024-01', revenue: 10000 },
          { month: '2024-02', revenue: 12000 },
        ],
        rowCount: 2,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('line');
      expect(config.xAxis.dataKey).toBe('month');
      expect(config.xAxis.label).toBe('Month');
      expect(config.yAxis.type).toBe('number');
      expect(config.series).toHaveLength(1);
      expect(config.series[0].dataKey).toBe('revenue');
      expect(config.series[0].name).toBe('Revenue');
      expect(config.series[0].color).toBe('#8884d8');
      expect(config.legend).toBe(false);
    });

    it('should generate area chart config with multiple series and legend', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'date', type: 'timestamp' },
          { name: 'revenue', type: 'float' },
          { name: 'expenses', type: 'float' },
        ],
        rows: [
          { date: '2024-01-01', revenue: 10000, expenses: 8000 },
          { date: '2024-02-01', revenue: 12000, expenses: 9000 },
        ],
        rowCount: 2,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('area');
      expect(config.xAxis.dataKey).toBe('date');
      expect(config.series).toHaveLength(2);
      expect(config.series[0].dataKey).toBe('revenue');
      expect(config.series[0].color).toBe('#8884d8');
      expect(config.series[1].dataKey).toBe('expenses');
      expect(config.series[1].color).toBe('#82ca9d');
      expect(config.legend).toBe(true);
      expect(config.series[0].type).toBe('monotone');
    });

    it('should generate bar chart config with category axis', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'country', type: 'text' },
          { name: 'users', type: 'integer' },
        ],
        rows: Array.from({ length: 10 }, (_, i) => ({
          country: `Country_${i}`,
          users: (i + 1) * 100,
        })),
        rowCount: 10,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('bar');
      expect(config.xAxis.dataKey).toBe('country');
      expect(config.xAxis.type).toBe('category');
      expect(config.yAxis.type).toBe('number');
      expect(config.series).toHaveLength(1);
      expect(config.series[0].dataKey).toBe('users');
    });

    it('should generate pie chart config with legend', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'plan', type: 'text' },
          { name: 'count', type: 'integer' },
        ],
        rows: [
          { plan: 'Basic', count: 100 },
          { plan: 'Pro', count: 250 },
          { plan: 'Enterprise', count: 50 },
        ],
        rowCount: 3,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('pie');
      expect(config.xAxis.dataKey).toBe('plan');
      expect(config.yAxis.dataKey).toBe('count');
      expect(config.legend).toBe(true);
      expect(config.series[0].dataKey).toBe('count');
    });

    it('should generate scatter chart config with numeric axes', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'height', type: 'float' },
          { name: 'weight', type: 'float' },
        ],
        rows: [
          { height: 170, weight: 65 },
          { height: 180, weight: 80 },
        ],
        rowCount: 2,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('scatter');
      expect(config.xAxis.dataKey).toBe('height');
      expect(config.xAxis.type).toBe('number');
      expect(config.yAxis.dataKey).toBe('weight');
      expect(config.yAxis.type).toBe('number');
    });

    it('should generate table config with all columns as series', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
          { name: 'email', type: 'text' },
        ],
        rows: [
          { id: '1', name: 'Alice', email: 'alice@example.com' },
        ],
        rowCount: 1,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.type).toBe('table');
      expect(config.series).toHaveLength(3);
      expect(config.series[0].dataKey).toBe('id');
      expect(config.series[1].dataKey).toBe('name');
      expect(config.series[2].dataKey).toBe('email');
      expect(config.legend).toBe(false);
    });

    it('should use default color palette for series', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'date', type: 'date' },
          { name: 'metric_a', type: 'float' },
          { name: 'metric_b', type: 'float' },
          { name: 'metric_c', type: 'float' },
        ],
        rows: [
          { date: '2024-01', metric_a: 1, metric_b: 2, metric_c: 3 },
        ],
        rowCount: 1,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.series[0].color).toBe('#8884d8');
      expect(config.series[1].color).toBe('#82ca9d');
      expect(config.series[2].color).toBe('#ffc658');
    });

    it('should format snake_case column names as labels', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'created_at', type: 'date' },
          { name: 'total_revenue', type: 'float' },
        ],
        rows: [{ created_at: '2024-01', total_revenue: 5000 }],
        rowCount: 1,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.xAxis.label).toBe('Created At');
      expect(config.series[0].name).toBe('Total Revenue');
    });

    it('should pass rows as data in the config', () => {
      const data: QueryResultData = {
        columns: [
          { name: 'month', type: 'date' },
          { name: 'value', type: 'integer' },
        ],
        rows: [
          { month: '2024-01', value: 100 },
          { month: '2024-02', value: 200 },
        ],
        rowCount: 2,
      };
      const recommendation = service.recommendChart(data);
      const config = service.getChartConfig(recommendation, data);

      expect(config.data).toEqual(data.rows);
    });
  });
});
