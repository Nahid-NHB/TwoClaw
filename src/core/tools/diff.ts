import { createTwoFilesPatch } from "diff";
import type { StagedMutation } from "./types";

export function formatPatch(
  filePath: string,
  before: string,
  after: string,
): string {
  return createTwoFilesPatch(filePath, filePath, before, after, "", "", {
    context: 3,
  });
}

export function composeBeforeAfter(sorted: StagedMutation[]): {
  before: string;
  after: string;
} {
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (last.toolCall.kind === "file_delete")
    return { before: last.toolCall.details.before ?? "", after: "" };
  const before =
    first.toolCall.kind === "file_create" ? "" : (first.toolCall.details.before ?? "");
  const after = last.toolCall.details.after ?? "";
  return { before, after };
}
