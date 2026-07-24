import { severityScore } from "./risk-scorer";
import type { DetectorFinding } from "../types/detection";

const specificity: Record<string, number> = {
  private_key: 9,
  jwt: 8,
  database_url: 7,
  credit_card: 6,
  api_key: 5,
  password: 4,
  email: 3,
  phone: 2,
};

export function deduplicateFindings(findings: DetectorFinding[]): DetectorFinding[] {
  const ordered = [...findings].sort((a, b) => a.range.start - b.range.start || b.range.end - a.range.end);
  const kept: DetectorFinding[] = [];

  for (const finding of ordered) {
    const overlapIndex = kept.findIndex(current => overlaps(current, finding));
    if (overlapIndex === -1) {
      kept.push(finding);
      continue;
    }

    const current = kept[overlapIndex];
    if (current && rank(finding) > rank(current)) kept[overlapIndex] = finding;
  }

  return kept.sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
}

function overlaps(a: DetectorFinding, b: DetectorFinding): boolean {
  return a.range.start < b.range.end && b.range.start < a.range.end;
}

function rank(finding: DetectorFinding): number {
  return (
    severityScore(finding.severity) * 1000 +
    (specificity[finding.type] ?? 0) * 100 +
    finding.confidence * 10 +
    (finding.range.end - finding.range.start) / 1000
  );
}