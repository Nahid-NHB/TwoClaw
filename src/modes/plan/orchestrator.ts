import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolCallLog } from "../../core/tools/tracker";
import { ToolExecutor } from "../../core/tools/executor";
import { createTools } from "../../core/tools/factory";
import { createWebTools } from "../../core/tools/web";
import { defaultAgentConfig } from "../../core/tools/types";
import { runAgentSession } from "../../core/session";
import { hasWebTools } from "../../core/config";
import { runApprovalFlow } from "../../tools/approval";
import { renderTerminalMarkdown } from "../../ui/terminal-md";
import { generatePlan } from "../../core/plan/planner";
import { printPlan, selectSteps } from "./selection";
import type { PlanStep } from "../../core/plan/types";

function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join("\n");
}

export async function runPlanMode(): Promise<void> {
  console.log(chalk.bold("\n🧭 Plan Mode\n"));

  const goal = await text({ message: "What is your goal?" });
  if (isCancel(goal) || !goal.trim()) return;

  const plan = await generatePlan(goal);

  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const proceed = await confirm({
    message: `Execute ${selected.length} step(s)`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return;

  const config = defaultAgentConfig();
  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);

  const tools = {
    ...createTools(executor),
    ...(hasWebTools() ? createWebTools(log) : {}),
  };

  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));

    const { text: stepText } = await runAgentSession({
      goal: stepPrompt(plan.goal, step),
      tools,
      maxSteps: 30,
    });

    if (stepText.trim()) console.log(renderTerminalMarkdown(stepText));
  }

  const ok = await runApprovalFlow(log);

  if (!ok) return executor.clearStaging();

  const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green("\n✓ Applied.\n"));
  }
  executor.clearStaging();
}
