import { describe, test, expect } from "bun:test";
import { ToolCallLog } from "./tracker";

describe("ToolCallLog", () => {
  test("record() assigns an incrementing id and defaults timestamp when omitted", () => {
    const log = new ToolCallLog();

    const first = log.record({ kind: "code_analysis", path: "a.txt", details: {} });
    const second = log.record({ kind: "code_analysis", path: "b.txt", details: {} });

    expect(first.id).toBe("call_0");
    expect(second.id).toBe("call_1");
    expect(first.timestamp).toBeInstanceOf(Date);
  });

  test("record() honors an explicit id and timestamp", () => {
    const log = new ToolCallLog();
    const ts = new Date("2026-01-01T00:00:00Z");

    const call = log.record({ id: "custom-id", timestamp: ts, kind: "code_analysis", path: "a.txt", details: {} });

    expect(call.id).toBe("custom-id");
    expect(call.timestamp).toBe(ts);
  });

  test("recording a read-only kind does not create a Staged Mutation", () => {
    const log = new ToolCallLog();
    log.record({ kind: "code_analysis", path: "read.txt", details: {} });

    expect(log.getToolCalls()).toHaveLength(1);
    expect(log.getStagedMutations()).toHaveLength(0);
  });

  test("recording a mutating kind creates a pending Staged Mutation backed by that Tool Call", () => {
    const log = new ToolCallLog();
    const call = log.record({ kind: "file_create", path: "new.txt", details: { after: "x" } });

    const [mutation] = log.getStagedMutations();
    expect(mutation!.id).toBe(call.id);
    expect(mutation!.toolCall).toBe(call);
    expect(mutation!.outcome).toBe("pending");
  });

  test("getPendingMutations() excludes already-resolved mutations", () => {
    const log = new ToolCallLog();
    const pendingCall = log.record({ kind: "file_create", path: "new.txt", details: { after: "x" } });
    const resolvedCall = log.record({ kind: "file_modify", path: "old.txt", details: {} });
    log.resolveMutation(resolvedCall.id, "approved", true);

    const pending = log.getPendingMutations();
    expect(pending.map((m) => m.id)).toEqual([pendingCall.id]);
  });

  test("resolveMutation() updates outcome and userApproved for a matching mutation", () => {
    const log = new ToolCallLog();
    const call = log.record({ kind: "file_delete", path: "gone.txt", details: {} });

    log.resolveMutation(call.id, "approved", true);

    const [mutation] = log.getStagedMutations();
    expect(mutation!.outcome).toBe("approved");
    expect(mutation!.userApproved).toBe(true);
  });

  test("resolveMutation() is a no-op for an unknown id", () => {
    const log = new ToolCallLog();
    log.record({ kind: "file_delete", path: "gone.txt", details: {} });

    expect(() => log.resolveMutation("does-not-exist", "rejected", false)).not.toThrow();
    expect(log.getStagedMutations()[0]!.outcome).toBe("pending");
  });
});
