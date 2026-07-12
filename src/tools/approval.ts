import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import type { ToolCallLog } from "../core/tools/tracker";
import type { StagedMutation } from "../core/tools/types";
import { groupPendingMutations } from "../core/tools/approval";
import { renderTerminalMarkdown } from "../ui/terminal-md";

interface ReviewGroup {
  label: string;
  mutationIds: string[];
  patch: string | null;
}

function toReviewGroups(pending: StagedMutation[]): ReviewGroup[] {
  const { files, shells } = groupPendingMutations(pending);

  const groups: ReviewGroup[] = files.map((f) =>
    f.isFolderOnly
      ? { label: `Create folder: ${f.path}`, mutationIds: f.mutationIds, patch: null }
      : { label: `${f.path} (${f.kinds.join(", ")})`, mutationIds: f.mutationIds, patch: f.patch },
  );

  for (const s of shells) {
    groups.push({
      label: `Shell: ${s.toolCall.details.command ?? "(no command)"}`,
      mutationIds: [s.id],
      patch: null,
    });
  }

  return groups;
}

export async function runApprovalFlow(log: ToolCallLog): Promise<boolean> {
  const pending = log.getPendingMutations();

  if (pending.length === 0) {
    console.log(
      chalk.dim("\nNo staged file, folder, or shell changes to review.\n"),
    );
    return false;
  }

  const choice = await select({
    message: "Apply staged changes?",
    options: [
      { value: "all", label: "Approve and apply all" },
      { value: "select", label: "Review one by one" },
      { value: "cancel", label: "Cancel" },
    ],
  });

  if (isCancel(choice) || choice === "cancel") {
    for (const m of pending) log.resolveMutation(m.id, "rejected", false);
    return false;
  }

  if (choice === "all") {
    for (const m of pending) log.resolveMutation(m.id, "approved", true);
    return true;
  }

  for (const g of toReviewGroups(pending)) {
    while (true) {
      const opt = await select({
        message: chalk.bold(g.label),
        options: [
          { value: "accept", label: "Accept" },
          { value: "diff", label: "Show diff", hint: g.patch ? "" : "N/A" },
          { value: "reject", label: "Reject" },
        ],
      });

      if (isCancel(opt)) {
        for (const m of pending) log.resolveMutation(m.id, "rejected", false);
        return false;
      }

      if (opt === "diff") {
        if (g.patch) {
          console.log(
            "\n" +
              renderTerminalMarkdown("```diff\n" + g.patch + "\n```\n") +
              "\n",
          );
        }
        continue;
      }

      for (const id of g.mutationIds) {
        log.resolveMutation(
          id,
          opt === "accept" ? "approved" : "rejected",
          opt === "accept",
        );
      }
      break;
    }
  }

  return log.getStagedMutations().some((m) => m.outcome === "approved");
}
