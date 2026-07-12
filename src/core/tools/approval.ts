import type { StagedMutation, ToolCallKind } from "./types";
import { composeBeforeAfter, formatPatch } from "./diff";

export interface FileMutationGroup {
  path: string;
  kinds: ToolCallKind[];
  mutationIds: string[];
  /** True when every mutation for this path is a folder_create (no diff to show). */
  isFolderOnly: boolean;
  patch: string | null;
}

export interface GroupedPendingMutations {
  files: FileMutationGroup[];
  shells: StagedMutation[];
}

/**
 * Groups pending Staged Mutations by path (collapsing create+modify chains
 * into one before/after diff) and separates out shell mutations, which have
 * no path to group by. Pure domain logic — each adapter renders this shape
 * with its own UI primitives.
 */
export function groupPendingMutations(pending: StagedMutation[]): GroupedPendingMutations {
  const byPath = new Map<string, StagedMutation[]>();
  const shells: StagedMutation[] = [];

  for (const m of pending) {
    if (m.toolCall.kind === "tool_execute") {
      shells.push(m);
      continue;
    }
    const key = m.toolCall.path;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key)!.push(m);
  }

  const files: FileMutationGroup[] = [];
  const pathEntries = [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [p, mutations] of pathEntries) {
    const sorted = [...mutations].sort(
      (x, y) => x.toolCall.timestamp.getTime() - y.toolCall.timestamp.getTime(),
    );
    const kinds = [...new Set(sorted.map((m) => m.toolCall.kind))];
    const isFolderOnly = sorted.every((m) => m.toolCall.kind === "folder_create");
    let patch: string | null = null;
    if (!isFolderOnly) {
      const { before, after } = composeBeforeAfter(sorted);
      patch = formatPatch(p, before, after);
    }
    files.push({ path: p, kinds, mutationIds: sorted.map((m) => m.id), isFolderOnly, patch });
  }

  return { files, shells };
}
