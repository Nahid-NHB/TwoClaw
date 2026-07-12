import { describe, test, expect } from "bun:test";
import { composeBeforeAfter, formatPatch } from "./diff";
import type { StagedMutation, ToolCallKind, ToolCallDetails } from "./types";

function mutation(timestamp: Date, kind: ToolCallKind, details: ToolCallDetails): StagedMutation {
  const id = `call_${timestamp.getTime()}`;
  return {
    id,
    outcome: "pending",
    toolCall: { id, timestamp, kind, path: "file.txt", details },
  };
}

describe("composeBeforeAfter", () => {
  test("a single file_create has empty before and the created content as after", () => {
    const result = composeBeforeAfter([mutation(new Date(0), "file_create", { after: "new content" })]);
    expect(result).toEqual({ before: "", after: "new content" });
  });

  test("a single file_modify uses its own before/after", () => {
    const result = composeBeforeAfter([
      mutation(new Date(0), "file_modify", { before: "old", after: "new" }),
    ]);
    expect(result).toEqual({ before: "old", after: "new" });
  });

  test("create followed by modify collapses to empty-before, latest-after", () => {
    const result = composeBeforeAfter([
      mutation(new Date(0), "file_create", { after: "v1" }),
      mutation(new Date(1), "file_modify", { before: "v1", after: "v2" }),
    ]);
    expect(result).toEqual({ before: "", after: "v2" });
  });

  test("a trailing file_delete reports the pre-delete content as before and empty after", () => {
    const result = composeBeforeAfter([
      mutation(new Date(0), "file_modify", { before: "orig", after: "edited" }),
      mutation(new Date(1), "file_delete", { before: "edited" }),
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
