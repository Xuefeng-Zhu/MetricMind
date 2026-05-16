import { describe, expect, it } from "vitest";

import { parseCsv } from "./parse-csv";

describe("parseCsv", () => {
  it("parses quoted CSV, sanitizes headers, and deduplicates repeated names", () => {
    const parsed = parseCsv(
      'Customer ID,Customer ID,Company Name\ncus_1,cus_1,"Acme, Inc."\ncus_2,cus_2,Globex\n'
    );

    expect(parsed.headers).toEqual(["customer_id", "customer_id_2", "company_name"]);
    expect(parsed.rows).toEqual([
      ["cus_1", "cus_1", "Acme, Inc."],
      ["cus_2", "cus_2", "Globex"],
    ]);
    expect(parsed.skippedRows).toBe(0);
  });

  it("skips rows with the wrong column count", () => {
    const parsed = parseCsv("name,amount\nAcme,100\nGlobex\nInitech,200\n");

    expect(parsed.rows).toEqual([
      ["Acme", "100"],
      ["Initech", "200"],
    ]);
    expect(parsed.skippedRows).toBe(1);
  });

  it("generates column names when headers are disabled", () => {
    const parsed = parseCsv("Acme,100\nGlobex,200\n", { hasHeader: false });

    expect(parsed.headers).toEqual(["column_1", "column_2"]);
    expect(parsed.rows).toHaveLength(2);
  });
});
