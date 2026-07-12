import { describe, test, expect } from "bun:test";
import { composeBeforeAfter, formatPatch } from "./diff";
import type { ActionLog } from "./types";

function action(overrides: Partial<ActionLog> & Pick<ActionLog, "type" | "timestamp">): ActionLog {
  return {
    id: `action_${overrides.timestamp.getTime()}`,
    path: "file.txt",
    details: {},
    status: "pending",
    ...overrides,
  };
}

describe("composeBeforeAfter", () => {
  test("a single file_create has empty before and the created content as after", () => {
    const result = composeBeforeAfter([
      action({ type: "file_create", timestamp: new Date(0), details: { after: "new content" } }),
    ]);
    expect(result).toEqual({ before: "", after: "new content" });
  });

  test("a single file_modify uses its own before/after", () => {
    const result = composeBeforeAfter([
      action({
        type: "file_modify",
        timestamp: new Date(0),
        details: { before: "old", after: "new" },
      }),
    ]);
    expect(result).toEqual({ before: "old", after: "new" });
  });

  test("create followed by modify collapses to empty-before, latest-after", () => {
    const result = composeBeforeAfter([
      action({ type: "file_create", timestamp: new Date(0), details: { after: "v1" } }),
      action({ type: "file_modify", timestamp: new Date(1), details: { before: "v1", after: "v2" } }),
    ]);
    expect(result).toEqual({ before: "", after: "v2" });
  });

  test("a trailing file_delete reports the pre-delete content as before and empty after", () => {
    const result = composeBeforeAfter([
      action({
        type: "file_modify",
        timestamp: new Date(0),
        details: { before: "orig", after: "edited" },
      }),
      action({ type: "file_delete", timestamp: new Date(1), details: { before: "edited" } }),
    ]);
    expect(result).toEqual({ before: "edited", after: "" });
  });
});

describe("formatPatch", () => {
  test("produces a unified diff referencing the given path", () => {
    const patch = formatPatch("src/foo.ts", "line one\n", "line one\nline two\n");
    expect(patch).toContain("src/foo.ts");
    expect(patch).toContain("+line two");
  });
});
