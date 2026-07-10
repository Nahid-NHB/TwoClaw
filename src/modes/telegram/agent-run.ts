import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../../tools/tracker";
import { ToolExecutor } from "../../tools/executor";
import { createAgentTools } from "../agent/tools";
import { createReadOnlyTools } from "../../tools/readonly";
import { createWebTools } from "../../tools/web";
import { defaultAgentConfig, type AgentConfig } from "../../tools/types";
import { hasWebTools } from "../../config";
import type { Plan, PlanStep } from "../plan/types";
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

function agentOptions(config: AgentConfig, maxSteps: number) {
  return {
    model: getAgentModel(),
    stopWhen: stepCountIs(maxSteps),
    instructions: `Workspace root: ${config.codebasePath}`,
  };
}

function extraWebTools(tracker: ActionTracker) {
  return hasWebTools() ? createWebTools(tracker) : {};
}

export async function runAsk(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  question: string,
) {
  const config = readOnlyConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = {
    ...createReadOnlyTools(executor),
    ...extraWebTools(tracker),
  };
  const agent = new ToolLoopAgent({
    ...agentOptions(config, 20),
    tools,
  });

  const { text } = await agent.generate({ prompt: question });
  await replyMd(ctx, text || "no answer");
}

export async function runAgent(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  goal: string,
) {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);
  const agent = new ToolLoopAgent({
    ...agentOptions(config, 40),
    tools,
  });
  const { text } = await agent.generate({ prompt: goal });
  if (text?.trim()) await replyMd(ctx, text.trim());
  await finishOrApprove(
    ctx,
    chatId,
    tracker,
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
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = {
    ...createAgentTools(executor),
    ...extraWebTools(tracker),
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
    const agent = new ToolLoopAgent({
      ...agentOptions(config, 30),
      tools,
    });
    const { text } = await agent.generate({ prompt });
    if (text?.trim()) await replyMd(ctx, text.trim());
  }

  await finishOrApprove(
    ctx,
    chatId,
    tracker,
    executor,
    "✅ All steps done. No file changes needed.",
  );
}
