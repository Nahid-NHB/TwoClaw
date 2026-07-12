import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "../../core/tools/types";
import { ToolCallLog } from "../../core/tools/tracker";
import { ToolExecutor } from "../../core/tools/executor";
import { createTools } from "../../core/tools/factory";
import { runAgentSession } from "../../core/session";
import { runApprovalFlow } from "./approval";
import { renderTerminalMarkdown } from "./terminal-md";

export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase…",
  });

  if (isCancel(goal) || !goal.trim()) return;

  const config = defaultAgentConfig();
  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);
  const tools = createTools(executor);

  const { text: resultText } = await runAgentSession({
    goal: goal.trim(),
    tools,
    maxSteps: 40,
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
    ].join("\n"),
    onToolCall: (toolName, input) => {
      const preview = JSON.stringify(input).slice(0, 160);
      console.log(
        chalk.green("  ✓"),
        chalk.bold(toolName),
        chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
      );
    },
  });

  if (resultText.trim()) console.log(renderTerminalMarkdown(resultText));

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
