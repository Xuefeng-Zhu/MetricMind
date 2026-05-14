import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Smoke test: Ensures no production page files under app/(protected)/
 * import from lib/mock-data. Mock data files should only be used in
 * tests and the demo page.
 *
 * Validates: Requirements 9.1, 9.2
 */

function getAllFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

describe("Smoke: No mock data imports in production pages", () => {
  const protectedDir = path.resolve(
    __dirname,
    "../../app/(protected)"
  );

  it("should have no imports from lib/mock-data in any production page file", () => {
    const files = getAllFiles(protectedDir, [".ts", ".tsx"]);

    expect(files.length).toBeGreaterThan(0);

    const mockDataPattern = /['"](@\/)?lib\/mock-data/;
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      if (mockDataPattern.test(content)) {
        const relativePath = path.relative(
          path.resolve(__dirname, "../.."),
          file
        );
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("should still have the lib/mock-data/ directory available for tests and demo", () => {
    const mockDataDir = path.resolve(__dirname, "../../lib/mock-data");
    expect(fs.existsSync(mockDataDir)).toBe(true);

    // Verify it has actual files in it
    const files = fs.readdirSync(mockDataDir);
    expect(files.length).toBeGreaterThan(0);
  });
});
