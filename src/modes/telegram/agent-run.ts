import { ToolCallLog } from "../../core/tools/tracker";
import { ToolExecutor } from "../../core/tools/executor";
import { createTools } from "../../core/tools/factory";
import { createWebTools } from "../../core/tools/web";
import { defaultAgentConfig, type AgentConfig } from "../../core/tools/types";
import { hasWebTools } from "../../core/config";
import { runAgentSession } from "../../core/session";
import type { Plan, PlanStep } from "../../core/plan/types";
import { replyMd } from "./text";
import { finishOrApprove } from "./approval-session";

function readOnlyConfig(): AgentConfig {
  const c = defaultAgentConfig();
  c.tools.allowFileCreation = false;
  c.tools.allowFileModification = false;
  c.tools.allowFolderCreation = false;
  c.tools.allowShellExecution = false;
  return c;
}

function workspaceInstructions(config: AgentConfig): string {
  return `Workspace root: ${config.codebasePath}`;
}

function extraWebTools(log: ToolCallLog) {
  return hasWebTools() ? createWebTools(log) : {};
}

export async function runAsk(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  question: string,
) {
  const config = readOnlyConfig();
  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);
  const tools = {
    ...createTools(executor, { readOnly: true }),
    ...extraWebTools(log),
  };

  const { text } = await runAgentSession({
    goal: question,
    tools,
    maxSteps: 20,
    instructions: workspaceInstructions(config),
  });
  await replyMd(ctx, text || "no answer");
}

export async function runAgent(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  goal: string,
) {
  const config = defaultAgentConfig();
  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);
  const tools = createTools(executor);

  const { text } = await runAgentSession({
    goal,
    tools,
    maxSteps: 40,
    instructions: workspaceInstructions(config),
  });
  if (text.trim()) await replyMd(ctx, text.trim());
  await finishOrApprove(
    ctx,
    chatId,
    log,
    executor,
    "✅ Done. No file changes were needed.",
  );
}

export async function runPlanSteps(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  plan: Plan,
  steps: PlanStep[],
) {
  const config = defaultAgentConfig();
  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);
  const tools = {
    ...createTools(executor),
    ...extraWebTools(log),
  };

  for (const step of steps) {
    await ctx.reply(`🔧 Executing: *${step.title}*`, {
      parse_mode: "Markdown",
    });
    const prompt = [
      `Goal: ${plan.goal}`,
      `Step: ${step.title}`,
      step.description,
    ].join("\n");
    const { text } = await runAgentSession({
      goal: prompt,
      tools,
      maxSteps: 30,
      instructions: workspaceInstructions(config),
    });
    if (text.trim()) await replyMd(ctx, text.trim());
  }

  await finishOrApprove(
    ctx,
    chatId,
    log,
    executor,
    "✅ All steps done. No file changes needed.",
  );
}
