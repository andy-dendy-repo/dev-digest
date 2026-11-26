import { describe, it, expect } from "vitest";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { isPlainShortcut, visibleFindings } from "./helpers";

function finding(id: string, severity: Severity, confidence: number): FindingRecord {
  return {
    id,
    severity,
    category: "bug",
    title: id,
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "",
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

const FINDINGS = [
  finding("s1", "SUGGESTION", 0.9),
  finding("w1", "WARNING", 0.9),
  finding("c-low", "CRITICAL", 0.5),
  finding("w2", "WARNING", 0.7),
];

describe("visibleFindings", () => {
  it("sorts by severity and keeps everything without filters", () => {
    expect(visibleFindings(FINDINGS, false).map((f) => f.id)).toEqual(["c-low", "w1", "w2", "s1"]);
  });

  it("combines the severity filter with hide-low-confidence", () => {
    expect(visibleFindings(FINDINGS, false, "WARNING").map((f) => f.id)).toEqual(["w1", "w2"]);
    expect(visibleFindings(FINDINGS, false, "CRITICAL").map((f) => f.id)).toEqual(["c-low"]);
    expect(visibleFindings(FINDINGS, true, "CRITICAL")).toEqual([]);
  });
});

describe("isPlainShortcut", () => {
  const key = (over: Partial<KeyboardEvent> = {}, target: Partial<HTMLElement> = { tagName: "DIV" }) =>
    ({ metaKey: false, ctrlKey: false, altKey: false, target, ...over }) as KeyboardEvent;

  it("accepts a bare key outside form fields", () => {
    expect(isPlainShortcut(key())).toBe(true);
  });

  it("rejects modifier chords", () => {
    expect(isPlainShortcut(key({ metaKey: true }))).toBe(false);
    expect(isPlainShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(isPlainShortcut(key({ altKey: true }))).toBe(false);
  });

  it("rejects typing in inputs, selects and editors", () => {
    expect(isPlainShortcut(key({}, { tagName: "INPUT" }))).toBe(false);
    expect(isPlainShortcut(key({}, { tagName: "TEXTAREA" }))).toBe(false);
    expect(isPlainShortcut(key({}, { tagName: "SELECT" }))).toBe(false);
    expect(isPlainShortcut(key({}, { tagName: "DIV", isContentEditable: true }))).toBe(false);
  });
});
