/**
 * Coding-question marks from tests passed (step rule):
 *   every test passes        → full marks
 *   at least half pass       → half the marks
 *   fewer than half / no compile → 0
 */
export function stepMarks(marks: number, passed: number, total: number, compileError?: boolean) {
  if (compileError || total <= 0) return 0;
  if (passed >= total) return marks;
  if (passed * 2 >= total) return marks / 2;
  return 0;
}

export const MARKING_RULE = "All tests pass → full marks · at least half pass → 50% · fewer → 0";
