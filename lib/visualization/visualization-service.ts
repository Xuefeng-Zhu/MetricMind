/**
 * Visualization Service
 *
 * Recommends chart types based on data shape and generates
 * Recharts-compatible configurations for rendering.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

// --- Types ---

export type ChartType = 'line' | 'bar' | 'pie' | 'kpi' | 'table' | 'area' | 'scatter';

export interface ChartRecommendation {
  type: ChartType;
  reason: string;
  axes: { x?: string; y?: string; series?: string };
}

export interface AxisConfig {
  dataKey: string;
  label: string;
  type?: 'number' | 'category';
}

export interface SeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  type?: string;
}

export interface ChartConfig {
  type: string;
  data: unknown[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  series: SeriesConfig[];
  legend: boolean;
  title?: string;
}

export type QueryResultData = {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

export interface VisualizationService {
  recommendChart(data: QueryResultData): ChartRecommendation;
  getChartConfig(recommendation: ChartRecommendation, data: QueryResultData): ChartConfig;
}

// --- Constants ---

const DEFAULT_COLOR_PALETTE = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#0088fe',
  '#00c49f',
];

/** Column types considered time-based */
const TIME_TYPES = ['date', 'timestamp', 'datetime', 'time'];

/** Column types considered numeric */
const NUMERIC_TYPES = ['integer', 'float', 'number', 'numeric', 'decimal', 'int', 'bigint', 'real', 'double'];

/** Column types considered categorical/text */
const CATEGORICAL_TYPES = ['text', 'string', 'varchar', 'char', 'category', 'boolean'];

/** Maximum categories for pie chart recommendation */
const MAX_PIE_CATEGORIES = 8;

// --- Helper Functions ---

/**
 * Determine if a column type is time-based.
 */
function isTimeType(type: string): boolean {
  return TIME_TYPES.includes(type.toLowerCase());
}

/**
 * Determine if a column type is numeric.
 */
function isNumericType(type: string): boolean {
  return NUMERIC_TYPES.includes(type.toLowerCase());
}

/**
 * Determine if a column type is categorical.
 */
function isCategoricalType(type: string): boolean {
  return CATEGORICAL_TYPES.includes(type.toLowerCase());
}

/**
 * Count distinct values for a column in the data rows.
 */
function countDistinctValues(rows: Record<string, unknown>[], columnName: string): number {
  const values = new Set(rows.map((row) => row[columnName]));
  return values.size;
}

/**
 * Classify columns into time, numeric, and categorical groups.
 */
function classifyColumns(columns: { name: string; type: string }[]): {
  timeColumns: { name: string; type: string }[];
  numericColumns: { name: string; type: string }[];
  categoricalColumns: { name: string; type: string }[];
} {
  const timeColumns: { name: string; type: string }[] = [];
  const numericColumns: { name: string; type: string }[] = [];
  const categoricalColumns: { name: string; type: string }[] = [];

  for (const col of columns) {
    if (isTimeType(col.type)) {
      timeColumns.push(col);
    } else if (isNumericType(col.type)) {
      numericColumns.push(col);
    } else if (isCategoricalType(col.type)) {
      categoricalColumns.push(col);
    }
  }

  return { timeColumns, numericColumns, categoricalColumns };
}

/**
 * Format a column name into a human-readable label.
 * Converts snake_case and camelCase to Title Case.
 */
function formatLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Service Implementation ---

/**
 * Creates a VisualizationService instance.
 */
export function createVisualizationService(): VisualizationService {
  return {
    recommendChart(data: QueryResultData): ChartRecommendation {
      const { columns, rows, rowCount } = data;

      // Guard: no data → table fallback
      if (!columns.length || rowCount === 0) {
        return {
          type: 'table',
          reason: 'No data available to visualize',
          axes: {},
        };
      }

      const { timeColumns, numericColumns, categoricalColumns } = classifyColumns(columns);

      // Rule 1: KPI card — single row with a single numeric column
      if (rowCount === 1 && numericColumns.length === 1 && columns.length === 1) {
        return {
          type: 'kpi',
          reason: 'Single numeric value detected',
          axes: { y: numericColumns[0].name },
        };
      }

      // Rule 2 & 5: Line chart or Area chart — time-based dimension + numeric measures
      if (timeColumns.length >= 1 && numericColumns.length >= 1) {
        const timeDimension = timeColumns[0].name;

        if (numericColumns.length >= 2) {
          // Rule 5: Area chart — time-based + 2+ measures
          return {
            type: 'area',
            reason: `Time series with multiple measures (${numericColumns.map((c) => c.name).join(', ')})`,
            axes: {
              x: timeDimension,
              y: numericColumns[0].name,
              series: numericColumns.length > 1 ? numericColumns[1].name : undefined,
            },
          };
        }

        // Rule 2: Line chart — time-based + single measure
        return {
          type: 'line',
          reason: `Time series data with ${timeDimension} dimension`,
          axes: {
            x: timeDimension,
            y: numericColumns[0].name,
          },
        };
      }

      // Rule 3 & 4: Bar chart or Pie chart — categorical dimension + single numeric measure
      if (categoricalColumns.length >= 1 && numericColumns.length === 1) {
        const categoryColumn = categoricalColumns[0].name;
        const distinctCount = countDistinctValues(rows, categoryColumn);

        // Rule 4: Pie chart — categorical + single numeric with ≤ 8 categories
        if (distinctCount <= MAX_PIE_CATEGORIES && distinctCount > 0) {
          return {
            type: 'pie',
            reason: `Categorical data with ${distinctCount} categories (suitable for pie chart)`,
            axes: {
              x: categoryColumn,
              y: numericColumns[0].name,
            },
          };
        }

        // Rule 3: Bar chart — categorical + single numeric with > 8 categories
        return {
          type: 'bar',
          reason: `Categorical data with ${distinctCount} categories`,
          axes: {
            x: categoryColumn,
            y: numericColumns[0].name,
          },
        };
      }

      // Rule 6: Scatter chart — two numeric columns with no clear dimension
      if (numericColumns.length === 2 && timeColumns.length === 0 && categoricalColumns.length === 0) {
        return {
          type: 'scatter',
          reason: `Two numeric columns without a clear dimension`,
          axes: {
            x: numericColumns[0].name,
            y: numericColumns[1].name,
          },
        };
      }

      // Rule 7: Table — default fallback
      return {
        type: 'table',
        reason: 'Data shape does not match a specific chart pattern',
        axes: {},
      };
    },

    getChartConfig(recommendation: ChartRecommendation, data: QueryResultData): ChartConfig {
      const { type, axes } = recommendation;
      const { columns, rows } = data;

      // Build series from numeric columns (excluding the x-axis column)
      const numericColumns = columns.filter(
        (col) => isNumericType(col.type) && col.name !== axes.x
      );

      const series: SeriesConfig[] = numericColumns.map((col, index) => ({
        dataKey: col.name,
        name: formatLabel(col.name),
        color: DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length],
        type: type === 'area' ? 'monotone' : undefined,
      }));

      // For KPI, use a minimal config
      if (type === 'kpi') {
        const valueColumn = axes.y || (numericColumns[0]?.name ?? '');
        return {
          type: 'kpi',
          data: rows,
          xAxis: { dataKey: '', label: '' },
          yAxis: { dataKey: valueColumn, label: formatLabel(valueColumn), type: 'number' },
          series: [
            {
              dataKey: valueColumn,
              name: formatLabel(valueColumn),
              color: DEFAULT_COLOR_PALETTE[0],
            },
          ],
          legend: false,
        };
      }

      // For table, return a simple config with all columns
      if (type === 'table') {
        return {
          type: 'table',
          data: rows,
          xAxis: { dataKey: '', label: '' },
          yAxis: { dataKey: '', label: '' },
          series: columns.map((col, index) => ({
            dataKey: col.name,
            name: formatLabel(col.name),
            color: DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length],
          })),
          legend: false,
        };
      }

      // For pie chart, use the categorical column as name and numeric as value
      if (type === 'pie') {
        const categoryKey = axes.x || '';
        const valueKey = axes.y || (numericColumns[0]?.name ?? '');
        return {
          type: 'pie',
          data: rows,
          xAxis: { dataKey: categoryKey, label: formatLabel(categoryKey), type: 'category' },
          yAxis: { dataKey: valueKey, label: formatLabel(valueKey), type: 'number' },
          series: [
            {
              dataKey: valueKey,
              name: formatLabel(valueKey),
              color: DEFAULT_COLOR_PALETTE[0],
            },
          ],
          legend: true,
        };
      }

      // For scatter chart
      if (type === 'scatter') {
        const xKey = axes.x || '';
        const yKey = axes.y || '';
        return {
          type: 'scatter',
          data: rows,
          xAxis: { dataKey: xKey, label: formatLabel(xKey), type: 'number' },
          yAxis: { dataKey: yKey, label: formatLabel(yKey), type: 'number' },
          series: [
            {
              dataKey: yKey,
              name: formatLabel(yKey),
              color: DEFAULT_COLOR_PALETTE[0],
            },
          ],
          legend: false,
        };
      }

      // For line, bar, area charts
      const xKey = axes.x || '';
      const xColumn = columns.find((col) => col.name === xKey);
      const xAxisType: 'number' | 'category' = xColumn && isTimeType(xColumn.type) ? 'category' : 'category';

      return {
        type,
        data: rows,
        xAxis: {
          dataKey: xKey,
          label: formatLabel(xKey),
          type: xAxisType,
        },
        yAxis: {
          dataKey: series[0]?.dataKey ?? '',
          label: series.length === 1 ? series[0].name : 'Value',
          type: 'number',
        },
        series,
        legend: series.length > 1,
      };
    },
  };
}
