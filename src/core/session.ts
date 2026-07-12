import { ToolLoopAgent, stepCountIs, type ToolSet } from "ai";
import { getAgentModel } from "./ai";

export interface AgentSessionOptions {
  /** The Goal (or Question, or Plan Step prompt) driving this session. */
  goal: string;
  tools: ToolSet;
  maxSteps: number;
  /** Verbatim system instructions, if this caller wants any. */
  instructions?: string;
  /** Called after each step with any Tool Calls made during it. */
  onToolCall?: (toolName: string, input: unknown) => void;
}

export interface AgentSessionResult {
  text: string;
}

/** Runs one Agent Session: hand the model a Goal and a set of Tools, get back its final text. */
export async function runAgentSession(
  opts: AgentSessionOptions,
): Promise<AgentSessionResult> {
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(opts.maxSteps),
    ...(opts.instructions ? { instructions: opts.instructions } : {}),
    tools: opts.tools,
  });

  const result = await agent.generate({
    prompt: opts.goal,
    ...(opts.onToolCall
      ? {
          onStepFinish: ({ toolCalls }: { toolCalls: { toolName: string; input: unknown }[] }) => {
            for (const tc of toolCalls) opts.onToolCall!(String(tc.toolName), tc.input);
          },
        }
      : {}),
  });

  return { text: result.text ?? "" };
}
