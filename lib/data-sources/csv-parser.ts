/**
 * CSV Parser for MetricMind
 *
 * Implements CSV parsing with:
 * - Comma-separated values
 * - Quoted fields (double quotes)
 * - Newlines within quoted fields
 * - Escaped quotes (double-double quotes)
 * - Malformed row skipping with count reporting
 * - Column type inference (text, integer, float, boolean, date, timestamp)
 * - 50MB file size limit enforcement
 */

export interface ParseOptions {
  maxRows?: number;
  delimiter?: string;
  hasHeader?: boolean;
}

export interface ColumnMetadata {
  name: string;
  data_type: 'text' | 'integer' | 'float' | 'boolean' | 'date' | 'timestamp';
  nullable: boolean;
  suggested_semantic_type: 'dimension' | 'measure' | null;
}

export interface ParseResult {
  columns: ColumnMetadata[];
  rowCount: number;
  skippedRows: number;
  data: Record<string, unknown>[];
}

export interface ColumnTypeInference {
  columnName: string;
  inferredType: string;
  confidence: number;
  sampleValues: string[];
}

export interface CSVParser {
  parse(file: Buffer, options?: ParseOptions): Promise<ParseResult>;
  inferTypes(sample: string[][]): ColumnTypeInference[];
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Parse CSV content into rows of fields, handling quoted fields,
 * escaped quotes, and newlines within quotes.
 */
function parseCSVContent(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double-double quotes)
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        // Regular character inside quotes (including newlines)
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle \r\n or standalone \r as row separator
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < content.length && content[i] === '\n') {
          i++;
        }
      } else if (char === '\n') {
        // Row separator
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Check if a value matches integer pattern: optional negative sign followed by digits
 */
function isInteger(value: string): boolean {
  return /^-?\d+$/.test(value);
}

/**
 * Check if a value matches float pattern: decimal or scientific notation
 */
function isFloat(value: string): boolean {
  return /^-?\d+\.\d+$/.test(value) || /^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(value);
}

/**
 * Check if a value matches boolean pattern
 */
function isBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  return ['true', 'false', 'yes', 'no', '1', '0'].includes(lower);
}

/**
 * Check if a value matches ISO date format (YYYY-MM-DD)
 */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime());
}

/**
 * Check if a value matches ISO timestamp format
 */
function isTimestamp(value: string): boolean {
  // Match ISO 8601 timestamps like: 2024-01-15T10:30:00, 2024-01-15T10:30:00Z, 2024-01-15T10:30:00.000Z, 2024-01-15T10:30:00+05:00
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Infer the type of a column based on its values
 */
function inferColumnType(values: string[]): { type: string; confidence: number } {
  const nonEmpty = values.filter((v) => v.trim() !== '');

  if (nonEmpty.length === 0) {
    return { type: 'text', confidence: 0 };
  }

  // Check each type in order of specificity
  const checks: { type: string; checker: (v: string) => boolean }[] = [
    { type: 'boolean', checker: isBoolean },
    { type: 'integer', checker: isInteger },
    { type: 'float', checker: isFloat },
    { type: 'date', checker: isDate },
    { type: 'timestamp', checker: isTimestamp },
  ];

  for (const { type, checker } of checks) {
    const matchCount = nonEmpty.filter(checker).length;
    const confidence = matchCount / nonEmpty.length;
    if (confidence === 1) {
      return { type, confidence };
    }
  }

  // Fallback to text
  return { type: 'text', confidence: 1 };
}

/**
 * Convert a string value to its typed representation
 */
function convertValue(value: string, type: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  switch (type) {
    case 'integer':
      return parseInt(trimmed, 10);
    case 'float':
      return parseFloat(trimmed);
    case 'boolean': {
      const lower = trimmed.toLowerCase();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    case 'date':
      return trimmed;
    case 'timestamp':
      return trimmed;
    default:
      return trimmed;
  }
}

export function createCSVParser(): CSVParser {
  return {
    async parse(file: Buffer, options?: ParseOptions): Promise<ParseResult> {
      // Enforce 50MB file size limit
      if (file.length > MAX_FILE_SIZE) {
        throw new Error(
          `File size ${file.length} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (50MB)`
        );
      }

      const delimiter = options?.delimiter ?? ',';
      const hasHeader = options?.hasHeader ?? true;
      const content = file.toString('utf-8');

      // Parse raw CSV content
      const rawRows = parseCSVContent(content, delimiter);

      if (rawRows.length === 0) {
        return {
          columns: [],
          rowCount: 0,
          skippedRows: 0,
          data: [],
        };
      }

      // Extract header row
      let headers: string[];
      let dataStartIndex: number;

      if (hasHeader) {
        headers = rawRows[0].map((h) => h.trim());
        dataStartIndex = 1;
      } else {
        // Generate column names if no header
        const columnCount = rawRows[0].length;
        headers = Array.from({ length: columnCount }, (_, i) => `column_${i + 1}`);
        dataStartIndex = 0;
      }

      const expectedColumnCount = headers.length;

      // Filter valid rows and track skipped rows
      const validRows: string[][] = [];
      let skippedRows = 0;

      const maxRows = options?.maxRows;
      for (let i = dataStartIndex; i < rawRows.length; i++) {
        if (maxRows !== undefined && validRows.length >= maxRows) {
          break;
        }

        const row = rawRows[i];
        if (row.length !== expectedColumnCount) {
          skippedRows++;
        } else {
          validRows.push(row);
        }
      }

      // Infer types from sample (use up to first 100 valid rows)
      const sampleSize = Math.min(validRows.length, 100);
      const sample = validRows.slice(0, sampleSize);

      // Build column samples for type inference
      const columnSamples: string[][] = headers.map((_, colIdx) =>
        sample.map((row) => row[colIdx])
      );

      const typeInferences = columnSamples.map((values, idx) => {
        const { type } = inferColumnType(values);
        return { columnName: headers[idx], type };
      });

      // Build column metadata
      const columns: ColumnMetadata[] = typeInferences.map(({ columnName, type }) => {
        const dataType = type as ColumnMetadata['data_type'];
        const nullable = true; // Assume all columns are nullable
        const suggested_semantic_type: 'dimension' | 'measure' | null =
          dataType === 'integer' || dataType === 'float' ? 'measure' : 'dimension';

        return {
          name: columnName,
          data_type: dataType,
          nullable,
          suggested_semantic_type,
        };
      });

      // Convert data rows to typed records
      const data: Record<string, unknown>[] = validRows.map((row) => {
        const record: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          record[header] = convertValue(row[idx], typeInferences[idx].type);
        });
        return record;
      });

      return {
        columns,
        rowCount: validRows.length,
        skippedRows,
        data,
      };
    },

    inferTypes(sample: string[][]): ColumnTypeInference[] {
      if (sample.length === 0) {
        return [];
      }

      // First row is treated as headers
      const headers = sample[0];
      const dataRows = sample.slice(1);

      if (dataRows.length === 0) {
        return headers.map((name) => ({
          columnName: name,
          inferredType: 'text',
          confidence: 0,
          sampleValues: [],
        }));
      }

      return headers.map((name, colIdx) => {
        const values = dataRows.map((row) => (colIdx < row.length ? row[colIdx] : ''));
        const { type, confidence } = inferColumnType(values);
        const sampleValues = values.slice(0, 5).filter((v) => v.trim() !== '');

        return {
          columnName: name,
          inferredType: type,
          confidence,
          sampleValues,
        };
      });
    },
  };
}
