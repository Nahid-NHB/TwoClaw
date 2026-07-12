import type { ToolCall, ToolCallKind, ToolCallDetails, StagedMutation, MutationOutcome } from "./types";
import { isMutating } from "./types";

/**
 * Records every Tool Call made during an Agent Session, and derives a
 * Staged Mutation queue from the subset of calls that mutate the
 * filesystem or run a shell command.
 */
export class ToolCallLog {
  private calls: ToolCall[] = [];
  private mutations: StagedMutation[] = [];

  record(entry: {
    kind: ToolCallKind;
    path: string;
    details: ToolCallDetails;
    id?: string;
    timestamp?: Date;
  }): ToolCall {
    const call: ToolCall = {
      id: entry.id ?? `call_${this.calls.length}`,
      timestamp: entry.timestamp ?? new Date(),
      kind: entry.kind,
      path: entry.path,
      details: { ...entry.details },
    };
    this.calls.push(call);

    if (isMutating(call.kind)) {
      this.mutations.push({ id: call.id, toolCall: call, outcome: "pending" });
    }

    return call;
  }

  getToolCalls(): readonly ToolCall[] {
    return this.calls;
  }

  getStagedMutations(): readonly StagedMutation[] {
    return this.mutations;
  }

  getPendingMutations(): StagedMutation[] {
    return this.mutations.filter((m) => m.outcome === "pending");
  }

  resolveMutation(id: string, outcome: MutationOutcome, userApproved?: boolean): void {
    const mutation = this.mutations.find((m) => m.id === id);
    if (!mutation) return;
    mutation.outcome = outcome;
    if (userApproved !== undefined) mutation.userApproved = userApproved;
  }
}
