import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolCallLog } from "../../core/tools/tracker";
import { ToolExecutor } from "../../core/tools/executor";
import { defaultAgentConfig } from "../../core/tools/types";
import { createTools } from "../../core/tools/factory";
import { createWebTools } from "../../core/tools/web";
import { runAgentSession } from "../../core/session";
import { runApprovalFlow } from "../../tools/approval";
import { renderTerminalMarkdown } from "../../ui/terminal-md";

function asMd(question: string, answer: string): string {
  return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
}

export async function runAskMode() {
  console.log(chalk.bold("\n❓ Ask Mode\n"));

  const question = await text({ message: "What do you want to ask?" });
  if (isCancel(question) || !question.trim()) return;

  // Read-only for the agent session, but file creation stays enabled so the
  // answer can be saved to a .md file below.
  const config = defaultAgentConfig();
  config.tools.allowFileModification = false;
  config.tools.allowFolderCreation = false;
  config.tools.allowShellExecution = false;

  const log = new ToolCallLog();
  const executor = new ToolExecutor(log, config);

  const tools = {
    ...createTools(executor, { readOnly: true }),
    ...createWebTools(log),
  };

  const { text: answer } = await runAgentSession({
    goal: question.trim(),
    tools,
    maxSteps: 20,
  });

  console.log("\n" + renderTerminalMarkdown(answer.trim() || "(no answer)") + "\n");

  const wantsSave = await confirm({
    message: "Save this answer to a .md file in the current directory?",
    initialValue: false,
  });
  if (isCancel(wantsSave) || !wantsSave) return;

  const filename = await text({
    message: "Filename",
    initialValue: "ask.md",
    validate: (v) => {
      const s = (v ?? "").trim();
      if (!s) return "Required";
      if (s.includes("..") || s.includes("/") || s.includes("\\"))
        return "No paths";
      if (!s.toLowerCase().endsWith(".md")) return "Must end with .md";
    },
  });

  if (isCancel(filename)) return;

  executor.createFile(filename, asMd(question, answer));
  const ok = await runApprovalFlow(log);
  if (!ok) return executor.clearStaging();

  executor.applyApprovedFromTracker();
  executor.clearStaging();
}
