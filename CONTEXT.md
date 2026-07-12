# TwoClaw

An AI coding agent that a user drives from more than one place (terminal, Telegram, and eventually other chat platforms), where every filesystem or shell change the agent wants to make is held back for the user's explicit approval before it touches disk.

## Language

**Interface**:
A surface through which a user talks to TwoClaw — the CLI (interactive terminal prompts) or Telegram today, with more chat platforms expected later. Each Interface implements the same Modes against the same core agent logic.
_Avoid_: mode (at this level), adapter (that's the implementation term, not the domain term), platform

**Mode**:
The kind of task the user is asking the agent to do within an Interface: Agent Mode (make changes), Plan Mode (produce a step-by-step plan, then execute selected steps), or Ask Mode (answer a question, read-only).
_Avoid_: mode (do not use for CLI-vs-Telegram — see Interface), sub-mode

**Agent Session**:
One run of the agent against a single Goal, Question, or Plan Step — from handing the model a prompt and a set of Tools through to it producing a final answer and zero or more Tool Calls.
_Avoid_: run, generation

**Goal**:
The task the user wants Agent Mode or a Plan Step to accomplish, stated in their own words.
_Avoid_: task, prompt (prompt is the literal text sent to the model; Goal is the user's intent)

**Tool**:
A single capability exposed to the model during an Agent Session (e.g. read a file, search files, execute a shell command). Tools are read-only or mutating.
_Avoid_: action (see Tool Call / Staged Mutation), function

**Tool Call**:
An immutable audit record that a Tool was invoked during an Agent Session, capturing what happened and its result. Every Tool Call is logged the moment it happens, regardless of whether the Tool was read-only or mutating.
_Avoid_: action, action log

**Staged Mutation**:
A Tool Call that would change the filesystem or run a shell command. It sits in the Workspace's queue with an outcome of pending until the user gives an Approval decision; only then does it actually touch disk. A Staged Mutation is always backed by a Tool Call, but not every Tool Call is a Staged Mutation.
_Avoid_: action, pending action, staged change (fine as casual prose, not as the canonical term)

**Approval**:
The user's decision — accept or reject — on one or more Staged Mutations, made after optionally reviewing the diff. Approval is required before any Staged Mutation is applied.
_Avoid_: confirmation

**Workspace**:
The codebase directory an Agent Session operates on, plus the in-memory overlay of not-yet-applied Staged Mutations layered on top of it. Reads made through the Workspace see the overlay; the real filesystem is untouched until Approval.
_Avoid_: codebase (codebase is the real files on disk; Workspace includes the overlay on top of them)

**Plan**:
A goal broken into an ordered list of Plan Steps, produced by a read-only Agent Session before any mutation happens.
_Avoid_: roadmap

**Plan Step**:
One item in a Plan — a title, description, and optional complexity rating — that becomes the Goal for its own Agent Session once selected for execution.
_Avoid_: task, step
