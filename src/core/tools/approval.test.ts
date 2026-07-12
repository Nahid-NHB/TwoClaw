import { describe, test, expect } from "bun:test";
import { groupPendingMutations } from "./approval";
import type { StagedMutation, ToolCallKind, ToolCallDetails } from "./types";

let seq = 0;
function mutation(path: string, kind: ToolCallKind, details: ToolCallDetails): StagedMutation {
  const id = `call_${seq++}`;
  return {
    id,
    outcome: "pending",
    toolCall: { id, timestamp: new Date(seq), kind, path, details },
  };
}

describe("groupPendingMutations", () => {
  test("groups multiple mutations to the same path into one file group with a combined diff", () => {
    const create = mutation("a.txt", "file_create", { after: "v1" });
    const modify = mutation("a.txt", "file_modify", { before: "v1", after: "v2" });

    const { files, shells } = groupPendingMutations([create, modify]);

    expect(shells).toEqual([]);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("a.txt");
    expect(files[0]!.kinds).toEqual(["file_create", "file_modify"]);
    expect(files[0]!.mutationIds).toEqual([create.id, modify.id]);
    expect(files[0]!.isFolderOnly).toBe(false);
    expect(files[0]!.patch).toContain("+v2");
  });

  test("a folder_create-only group has no patch", () => {
    const { files } = groupPendingMutations([mutation("dir", "folder_create", { after: "dir" })]);
    expect(files[0]!.isFolderOnly).toBe(true);
    expect(files[0]!.patch).toBeNull();
  });

  test("tool_execute mutations are returned separately as shells, not grouped by path", () => {
    const shell = mutation("shell", "tool_execute", { command: "echo hi" });
    const { files, shells } = groupPendingMutations([shell]);
    expect(files).toEqual([]);
    expect(shells).toEqual([shell]);
  });

  test("file groups are sorted by path", () => {
    const { files } = groupPendingMutations([
      mutation("b.txt", "file_create", { after: "b" }),
      mutation("a.txt", "file_create", { after: "a" }),
    ]);
    expect(files.map((f) => f.path)).toEqual(["a.txt", "b.txt"]);
  });
});
