/**
 * Coding-question marks from tests passed. Two rules:
 *   steps (default)  every test passes → full · at least half → half · fewer → 0
 *   perTest          each passing test is worth marks ÷ tests (marks = tests → one mark per test)
 * A compile error is always 0.
 */
export type Marking = "steps" | "perTest";

export function codingMarks(marks: number, passed: number, total: number, compileError?: boolean, marking: Marking = "steps") {
  if (compileError || total <= 0) return 0;
  if (marking === "perTest") return Math.round(((marks * Math.min(passed, total)) / total) * 100) / 100;
  if (passed >= total) return marks;
  if (passed * 2 >= total) return marks / 2;
  return 0;
}

/** @deprecated use codingMarks */
export const stepMarks = (marks: number, passed: number, total: number, compileError?: boolean) => codingMarks(marks, passed, total, compileError);

export const ruleText = (marking: Marking = "steps") =>
  marking === "perTest" ? "One mark per test case passed" : "All tests pass → full marks · at least half pass → 50% · fewer → 0";
export const MARKING_RULE = ruleText("steps");
