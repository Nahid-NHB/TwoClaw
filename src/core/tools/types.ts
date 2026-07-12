export type ToolCallKind =
  | "file_create"
  | "file_modify"
  | "file_delete"
  | "folder_create"
  | "code_analysis"
  | "tool_execute";

export interface ToolCallDetails {
  before?: string;
  after?: string;
  toolName?: string;
  toolResult?: string;
  error?: string;
  command?: string;
}

/** An immutable audit record of a single tool invocation during an Agent Session. */
export interface ToolCall {
  id: string;
  timestamp: Date;
  kind: ToolCallKind;
  path: string;
  details: ToolCallDetails;
}

export type MutationOutcome = "pending" | "approved" | "rejected";

/**
 * A Tool Call that would change the filesystem or run a shell command.
 * Queued until the user gives an Approval decision; only then is it applied.
 */
export interface StagedMutation {
  id: string;
  toolCall: ToolCall;
  outcome: MutationOutcome;
  userApproved?: boolean;
}

export function isMutating(kind: ToolCallKind): boolean {
  return kind !== "code_analysis";
}

export interface AgentConfig {
  codebasePath: string;
  maxFileSizeToRead: number;
  excludePatterns: string[];
  tools: {
    allowShellExecution: boolean;
    allowFileModification: boolean;
    allowFileCreation: boolean;
    allowFolderCreation: boolean;
  };
}

export const defaultAgentConfig = (): AgentConfig => ({
  codebasePath: process.cwd(),
  maxFileSizeToRead: 1024 * 1024,
  excludePatterns: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "*.log",
    ".env*",
  ],
  tools: {
    allowShellExecution: true,
    allowFileModification: true,
    allowFileCreation: true,
    allowFolderCreation: true,
  },
});

/** A read-only variant of the default config: no mutation tools are enabled. */
export const readOnlyAgentConfig = (): AgentConfig => {
  const config = defaultAgentConfig();
  config.tools.allowFileCreation = false;
  config.tools.allowFileModification = false;
  config.tools.allowFolderCreation = false;
  config.tools.allowShellExecution = false;
  return config;
};
