import { describe, test, expect } from "bun:test";
import { ActionTracker } from "./tracker";

describe("ActionTracker", () => {
  test("log() assigns an incrementing id and defaults timestamp when omitted", () => {
    const tracker = new ActionTracker();

    const first = tracker.log({
      type: "file_create",
      path: "a.txt",
      details: { after: "hello" },
      status: "pending",
    });
    const second = tracker.log({
      type: "file_create",
      path: "b.txt",
      details: { after: "world" },
      status: "pending",
    });

    expect(first.id).toBe("action_0");
    expect(second.id).toBe("action_1");
    expect(first.timestamp).toBeInstanceOf(Date);
  });

  test("log() honors an explicit id and timestamp", () => {
    const tracker = new ActionTracker();
    const ts = new Date("2026-01-01T00:00:00Z");

    const action = tracker.log({
      id: "custom-id",
      timestamp: ts,
      type: "code_analysis",
      path: "a.txt",
      details: {},
      status: "executed",
    });

    expect(action.id).toBe("custom-id");
    expect(action.timestamp).toBe(ts);
  });

  test("getPendingMutations() returns only pending mutating actions, excluding read-only and non-pending entries", () => {
    const tracker = new ActionTracker();

    tracker.log({
      type: "code_analysis",
      path: "read.txt",
      details: {},
      status: "executed",
    });
    const pendingCreate = tracker.log({
      type: "file_create",
      path: "new.txt",
      details: { after: "x" },
      status: "pending",
    });
    tracker.log({
      type: "file_modify",
      path: "already-approved.txt",
      details: {},
      status: "approved",
    });
    const pendingShell = tracker.log({
      type: "tool_execute",
      path: "shell",
      details: { command: "echo hi" },
      status: "pending",
    });

    const pending = tracker.getPendingMutations();
    expect(pending.map((a) => a.id)).toEqual([pendingCreate.id, pendingShell.id]);
  });

  test("updateStatus() updates status and userApproved for a matching action", () => {
    const tracker = new ActionTracker();
    const action = tracker.log({
      type: "file_delete",
      path: "gone.txt",
      details: {},
      status: "pending",
    });

    tracker.updateStatus(action.id, "approved", true);

    const [updated] = tracker.getActions();
    expect(updated!.status).toBe("approved");
    expect(updated!.userApproved).toBe(true);
  });

  test("updateStatus() is a no-op for an unknown id", () => {
    const tracker = new ActionTracker();
    tracker.log({
      type: "file_delete",
      path: "gone.txt",
      details: {},
      status: "pending",
    });

    expect(() => tracker.updateStatus("does-not-exist", "rejected", false)).not.toThrow();
    expect(tracker.getActions()[0]!.status).toBe("pending");
  });
});
