import { Markup } from "telegraf";
import type { ToolCallLog } from "../../core/tools/tracker";
import type { ToolExecutor } from "../../core/tools/executor";
import type { StagedMutation } from "../../core/tools/types";
import { groupPendingMutations } from "../../core/tools/approval";
import { clip } from "./text";

export interface ApprovalSession {
  log: ToolCallLog;
  executor: ToolExecutor;
  pending: StagedMutation[];
}

export const approvalSessions = new Map<number, ApprovalSession>();

export function approvalSummary(pending: StagedMutation[]): string {
  const { files, shells } = groupPendingMutations(pending);
  const fileLines = files.map(
    (f) => `📄 ${f.path} (${f.kinds.map((k) => k.replace(/_/g, " ")).join(", ")})`,
  );
  const shellLines = shells.map((s) => `🖥 Shell: ${s.toolCall.details.command}`);
  return [
    "Staged changes — review before applying",
    "",
    ...fileLines,
    ...shellLines,
    "",
    `Total: ${pending.length} change(s)`,
  ].join("\n");
}

export function approvalDiff(pending: StagedMutation[]): string {
  const { files, shells } = groupPendingMutations(pending);
  const parts: string[] = [];
  for (const f of files) {
    if (f.patch) parts.push(clip(f.patch, 1500));
  }
  for (const s of shells) parts.push(`🖥 Shell: ${s.toolCall.details.command}`);
  return parts.join("\n\n").trim();
}

async function promptApproval(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  session: ApprovalSession,
) {
  approvalSessions.set(chatId, session);
  await ctx.reply(approvalSummary(session.pending), {
    ...Markup.inlineKeyboard([
      [Markup.button.callback("📋 Show Diff", "approval_diff")],
      [
        Markup.button.callback("✅ Accept All", "approval_accept"),
        Markup.button.callback("❌ Reject All", "approval_reject"),
      ],
    ]),
  });
}

export async function finishOrApprove(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  log: ToolCallLog,
  executor: ToolExecutor,
  noChangesMsg: string,
) {
  const pending = log.getPendingMutations();
  if (pending.length === 0) {
    await ctx.reply(noChangesMsg);
    return;
  }
  await promptApproval(ctx, chatId, { log, executor, pending });
}
