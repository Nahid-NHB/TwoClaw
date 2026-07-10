import {
  extractJsonMiddleware,
  generateText,
  stepCountIs,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import chalk from "chalk";
import { Output } from "ai";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../../tools/tracker";
import { ToolExecutor } from "../../tools/executor";
import { defaultAgentConfig } from "../../tools/types";
import { createReadOnlyTools } from "../../tools/readonly";
import { createWebTools } from "../../tools/web";
import { hasWebTools } from "../../config";
import type { Plan, PlanStep } from "./types";

const planSchema = z.object({
  researchSummary: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        hints: z.array(z.string()).optional(),
        complexity: z.enum(["low", "medium", "high"]).optional(),
      }),
    )
    .min(1)
    .max(15),
});

const PLAN_INSTRUCTIONS = (codebase: string, hasWeb: boolean) =>
  [
    "You are a Plan-Mode planner. You DO NOT modify files.",
    `Workspace: ${codebase}`,
    "Use read-only tools for codebase/skills research.",
    hasWeb
      ? "Web tools are available (web_search/web_crawl/fetch_url). Use only when needed."
      : "Web tools are unavailable (no FIRECRAWL_API_KEY).",
    "Output must match the provided JSON schema.",
    "Keep it short: 1–15 steps.",
  ].join("\n");

export async function generatePlan(goal: string) {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);

  const hasWeb = hasWebTools();
  const model = wrapLanguageModel({
    model: getAgentModel(),
    middleware: extractJsonMiddleware(),
  });

  const tools = {
    ...createReadOnlyTools(executor),
    ...(hasWeb ? createWebTools(tracker) : {}),
  };

  console.log(chalk.cyan("\n🔍 Researching & drafting a plan…\n"));

  const result = await generateText({
    model,
    tools,
    stopWhen: stepCountIs(20),
    system: PLAN_INSTRUCTIONS(config.codebasePath, hasWeb),
    prompt: `User goal: \n${goal}`,
    output: Output.object({ schema: planSchema }),
  });

  const validated = planSchema.parse(result.output);

  const steps: PlanStep[] = validated.steps.map((s, i) => ({
    id: `step-${i + 1}`,
    title: s.title,
    description: s.description,
    hints: s.hints,
    complexity: s.complexity,
  }));

  return { goal, researchSummary: validated.researchSummary, steps };
}
