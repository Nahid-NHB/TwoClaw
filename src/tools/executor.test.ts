import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ToolExecutor } from "./executor";
import { ActionTracker } from "./tracker";
import { defaultAgentConfig } from "./types";
import type { AgentConfig } from "./types";

let workspace: string;
let config: AgentConfig;
let tracker: ActionTracker;
let executor: ToolExecutor;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), "twoclaw-executor-"));
  config = { ...defaultAgentConfig(), codebasePath: workspace };
  tracker = new ActionTracker();
  executor = new ToolExecutor(tracker, config);
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe("readFile", () => {
  test("reads an existing file's contents", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "hello");
    expect(executor.readFile("a.txt")).toBe("hello");
  });

  test("throws for a missing file", () => {
    expect(() => executor.readFile("missing.txt")).toThrow("File not found");
  });

  test("throws for a path excluded by policy", () => {
    fs.mkdirSync(path.join(workspace, "node_modules"));
    fs.writeFileSync(path.join(workspace, "node_modules", "x.js"), "x");
    expect(() => executor.readFile("node_modules/x.js")).toThrow("excluded by policy");
  });

  test("throws for a file larger than maxFileSizeToRead", () => {
    config.maxFileSizeToRead = 4;
    executor = new ToolExecutor(tracker, config);
    fs.writeFileSync(path.join(workspace, "big.txt"), "way too big");
    expect(() => executor.readFile("big.txt")).toThrow("File too large");
  });

  test("does not escape the workspace root", () => {
    expect(() => executor.readFile("../outside.txt")).toThrow("escapes workspace");
  });
});

describe("createFile / modifyFile / deleteFile staging", () => {
  test("createFile stages content without writing to disk", () => {
    executor.createFile("new.txt", "staged content");
    expect(fs.existsSync(path.join(workspace, "new.txt"))).toBe(false);
    expect(executor.getEffectiveText("new.txt")).toBe("staged content");
  });

  test("createFile throws if the file already exists", () => {
    fs.writeFileSync(path.join(workspace, "exists.txt"), "already here");
    expect(() => executor.createFile("exists.txt", "x")).toThrow("already exists");
  });

  test("createFile throws when file creation is disabled", () => {
    config.tools.allowFileCreation = false;
    executor = new ToolExecutor(tracker, config);
    expect(() => executor.createFile("new.txt", "x")).toThrow("disabled");
  });

  test("modifyFile stages a replacement without touching disk", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "before");
    executor.modifyFile("a.txt", "after");
    expect(fs.readFileSync(path.join(workspace, "a.txt"), "utf8")).toBe("before");
    expect(executor.getEffectiveText("a.txt")).toBe("after");
  });

  test("modifyFile throws for a nonexistent file", () => {
    expect(() => executor.modifyFile("nope.txt", "x")).toThrow("file not found");
  });

  test("deleteFile stages a deletion; getEffectiveText reports it gone", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "content");
    executor.deleteFile("a.txt");
    expect(fs.existsSync(path.join(workspace, "a.txt"))).toBe(true);
    expect(executor.getEffectiveText("a.txt")).toBeUndefined();
  });
});

describe("createFolder", () => {
  test("stages a folder without creating it on disk", () => {
    executor.createFolder("newdir");
    expect(fs.existsSync(path.join(workspace, "newdir"))).toBe(false);
  });

  test("throws when folder creation is disabled", () => {
    config.tools.allowFolderCreation = false;
    executor = new ToolExecutor(tracker, config);
    expect(() => executor.createFolder("newdir")).toThrow("disabled");
  });
});

describe("listFiles", () => {
  test("lists entries and skips excluded patterns", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "");
    fs.mkdirSync(path.join(workspace, "node_modules"));
    fs.writeFileSync(path.join(workspace, "node_modules", "x.js"), "");

    const out = executor.listFiles(".", false);
    expect(out).toContain("a.txt");
    expect(out).not.toContain("node_modules");
  });
});

describe("searchFiles", () => {
  test("matches by glob pattern and optional content substring", () => {
    fs.writeFileSync(path.join(workspace, "a.ts"), "export const x = 1;");
    fs.writeFileSync(path.join(workspace, "b.ts"), "export const y = 2;");
    fs.writeFileSync(path.join(workspace, "c.md"), "notes");

    const byExt = executor.searchFiles(".", "*.ts");
    expect(byExt).toContain("a.ts");
    expect(byExt).toContain("b.ts");
    expect(byExt).not.toContain("c.md");

    const byContent = executor.searchFiles(".", "*.ts", "x = 1");
    expect(byContent).toBe("a.ts");
  });
});

describe("analyzeCodebase", () => {
  test("counts files and directories excluding policy patterns", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "");
    fs.mkdirSync(path.join(workspace, "dir"));
    fs.writeFileSync(path.join(workspace, "dir", "b.txt"), "");
    fs.mkdirSync(path.join(workspace, "node_modules"));
    fs.writeFileSync(path.join(workspace, "node_modules", "x.js"), "");

    const summary = executor.analyzeCodebase(".");
    expect(summary).toBe("Files: 2 | Directories: 1");
  });
});

describe("applyApprovedFromTracker", () => {
  test("only writes actions with status approved, ignoring pending/rejected", () => {
    executor.createFile("kept.txt", "keep me");
    executor.createFile("dropped.txt", "drop me");

    const [kept, dropped] = tracker.getActions();
    tracker.updateStatus(kept!.id, "approved", true);
    tracker.updateStatus(dropped!.id, "rejected", false);

    const { errors } = executor.applyApprovedFromTracker();

    expect(errors).toEqual([]);
    expect(fs.readFileSync(path.join(workspace, "kept.txt"), "utf8")).toBe("keep me");
    expect(fs.existsSync(path.join(workspace, "dropped.txt"))).toBe(false);
  });

  test("applies an approved folder_create with mkdir -p semantics", () => {
    executor.createFolder("a/b/c");
    tracker.updateStatus(tracker.getActions()[0]!.id, "approved", true);

    executor.applyApprovedFromTracker();

    expect(fs.existsSync(path.join(workspace, "a/b/c"))).toBe(true);
  });

  test("applies an approved file_delete by removing the file from disk", () => {
    fs.writeFileSync(path.join(workspace, "gone.txt"), "bye");
    executor.deleteFile("gone.txt");
    tracker.updateStatus(tracker.getActions()[0]!.id, "approved", true);

    executor.applyApprovedFromTracker();

    expect(fs.existsSync(path.join(workspace, "gone.txt"))).toBe(false);
  });

  test("runs an approved shell command in the workspace", () => {
    executor.queueShell(`node -e "require('fs').writeFileSync('marker.txt','ran')"`);
    tracker.updateStatus(tracker.getActions()[0]!.id, "approved", true);

    const { errors } = executor.applyApprovedFromTracker();

    expect(errors).toEqual([]);
    expect(fs.existsSync(path.join(workspace, "marker.txt"))).toBe(true);
  });
});

describe("clearStaging", () => {
  test("removes overlay and deleted entries, restoring disk-truth reads", () => {
    fs.writeFileSync(path.join(workspace, "a.txt"), "on disk");
    executor.modifyFile("a.txt", "overlaid");
    expect(executor.getEffectiveText("a.txt")).toBe("overlaid");

    executor.clearStaging();

    expect(executor.getEffectiveText("a.txt")).toBe("on disk");
  });
});
