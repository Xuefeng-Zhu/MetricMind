export interface ReadinessScoreInput {
  rowCount: number;
  columnCount: number;
  nullRate: number;
  piiColumnCount: number;
  typedColumnCount: number;
  semanticColumnCount: number;
}

export function calculateReadinessScore(input: ReadinessScoreInput): number {
  if (input.rowCount === 0 || input.columnCount === 0) return 0;

  const typeCoverage = input.typedColumnCount / input.columnCount;
  const semanticCoverage = input.semanticColumnCount / input.columnCount;
  const completeness = 1 - input.nullRate;
  const piiPenalty = Math.min(0.2, input.piiColumnCount * 0.04);

  const score =
    typeCoverage * 30 +
    semanticCoverage * 35 +
    completeness * 25 +
    (1 - piiPenalty) * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}
