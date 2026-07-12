# Split Tool Call (audit log) from Staged Mutation (approval queue)

`ActionLog`/`ActionTracker` previously modeled both a read-only tool-call audit trail and a pending-mutation approval queue as one type, distinguished only by `isMutationType()` and an initial status of `"executed"` vs `"pending"`. This conflated two different lifecycles under one name ("Action").

We're splitting them into two concepts: Tool Call (every tool invocation, logged immediately, immutable) and Staged Mutation (the subset of Tool Calls that change the filesystem or run a shell command, which queue for Approval before being applied). Every Staged Mutation is backed by a Tool Call, but not every Tool Call is a Staged Mutation. This is a data-model change touching `ActionTracker`, the approval flow, and both adapters, so it's worth recording why the split happened rather than leaving it to be rediscovered from a diff.
