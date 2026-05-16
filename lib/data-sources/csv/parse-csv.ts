import type { ParsedCsv } from "@/lib/data-sources/types";

export interface ParseCsvOptions {
  delimiter?: string;
  hasHeader?: boolean;
  maxRows?: number;
}

const DEFAULT_DELIMITER = ",";

function sanitizeHeader(header: string, index: number): string {
  const normalized = header
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalized || `column_${index + 1}`;
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header}_${count + 1}`;
  });
}

function parseRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (content[index + 1] === "\n") {
        index++;
      }
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0)
  );
}

export function parseCsv(input: Buffer | string, options: ParseCsvOptions = {}): ParsedCsv {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  const hasHeader = options.hasHeader ?? true;
  const content = Buffer.isBuffer(input) ? input.toString("utf-8") : input;
  const rawRows = parseRows(content, delimiter);

  if (rawRows.length === 0) {
    return { headers: [], rows: [], skippedRows: 0 };
  }

  const firstRow = rawRows[0];
  const headers = dedupeHeaders(
    (hasHeader
      ? firstRow
      : firstRow.map((_, index) => `column_${index + 1}`)
    ).map(sanitizeHeader)
  );
  const expectedColumnCount = headers.length;
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rows: string[][] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    if (options.maxRows !== undefined && rows.length >= options.maxRows) {
      break;
    }

    if (row.length !== expectedColumnCount) {
      skippedRows++;
      continue;
    }

    rows.push(row);
  }

  return { headers, rows, skippedRows };
}
