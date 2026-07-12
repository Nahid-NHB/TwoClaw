# TwoClaw

[![CI](https://github.com/Nahid-NHB/TwoClaw/actions/workflows/ci.yml/badge.svg)](https://github.com/Nahid-NHB/TwoClaw/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An AI coding agent you drive from the terminal **or Telegram**, where every filesystem or shell change the agent wants to make is **staged and held back for your explicit approval** before it ever touches disk.

TwoClaw isn't just a chat wrapper around an LLM. Its core design constraint is that mutation is never implicit: the agent runs against an in-memory overlay of your workspace, every tool call is logged as an immutable audit record, and only a subset of those calls — the ones that would actually change something — get queued for you to accept or reject, with a real diff, before `applyApproved` ever writes to disk. See [`docs/adr/0002-split-tool-call-and-staged-mutation.md`](./docs/adr/0002-split-tool-call-and-staged-mutation.md) for why that split exists.

<!--
Demo placeholder — capture and embed here:
  1. The startup banner + CLI/Telegram/Exit selector
  2. Agent Mode running a goal with live tool-call logging
  3. The approval prompt showing a staged diff (Accept / Reject / Show Diff)
An asciinema recording or a short terminal GIF (e.g. via `vhs` or `terminalizer`) works well for this.
-->

## Features

- **Approval-gated mutations** — file creates/edits/deletes and shell commands are staged, diffed, and require explicit approval (all-at-once or one-by-one) before anything touches disk.
- **Three modes** — **Agent Mode** (make changes), **Plan Mode** (research a goal, propose ranked steps with complexity ratings, pick which to run), **Ask Mode** (read-only Q&A, rendered as formatted markdown in the terminal).
- **Two interfaces, one core** — the same session/tool/approval logic backs both an interactive CLI (`@clack/prompts`) and a Telegram bot (`telegraf`), so the agent is driven identically whether you're at a keyboard or on your phone.
- **Model-agnostic via OpenRouter** — point `OPENROUTER_DEFAULT_MODEL` at any model OpenRouter routes to; no hardcoded provider lock-in.
- **Web-aware (optional)** — `web_search`, `web_crawl`, and `fetch_url` tools via Firecrawl, enabled automatically when `FIRECRAWL_API_KEY` is set.
- **Sandboxed workspace reads** — path-escape protection and configurable excludes (`node_modules`, `.git`, `dist`, `.env*`, etc.) on every file operation.

## Architecture

```
src/
├── core/            # interface-agnostic: agent sessions, tools, staging/approval, plan generation
│   ├── ai/          # OpenRouter provider wiring
│   ├── config/      # env-driven feature flags (e.g. web tools)
│   ├── plan/         # Plan Mode: research pass + ranked step generation
│   ├── tools/        # tool factory, executor (in-memory overlay), tracker, diff, approval grouping
│   └── session.ts    # runAgentSession — the model step-loop shared by every mode
└── adapters/
    ├── cli/          # @clack/prompts terminal UI: banner, selector, agent/ask/plan screens
    └── telegram/     # telegraf bot: commands, inline-keyboard approval & plan-step selection
```

`core` has no dependency on Telegraf or `@clack/prompts` — both adapters are thin rendering layers over the same session/tool/approval APIs. Why the split happened, and why Telegram isn't yet generalized behind a `ChatAdapter` interface, is recorded in [`docs/adr/0001-core-adapter-split.md`](./docs/adr/0001-core-adapter-split.md).

Domain vocabulary (Interface, Mode, Goal, Tool Call, Staged Mutation, Approval, Workspace, Plan, Plan Step) is defined in [`CONTEXT.md`](./CONTEXT.md).

## Setup

Requires [Bun](https://bun.com) v1.3+.

```bash
bun install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Auth for model calls via [OpenRouter](https://openrouter.ai) |
| `OPENROUTER_DEFAULT_MODEL` | Yes | Which model to route to, e.g. `anthropic/claude-sonnet-4.5` |
| `TELEGRAM_BOT_TOKEN` | For Telegram mode | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_OWNER_ID` | For Telegram mode | Your Telegram user ID — the bot only responds to this ID |
| `FIRECRAWL_API_KEY` | Optional | Enables `web_search` / `web_crawl` / `fetch_url` tools |
| `SKILLS_DIRS` | Optional | Colon-separated extra directories to search for agent skills |

## Usage

```bash
bun run index.ts        # banner + interactive picker: CLI / Telegram / Exit
bun run index.ts wakeup # same as above, explicitly
```

Picking **CLI** drops you into a submenu:

- **Agent Mode** — describe a goal in free text; the agent runs with full (mutating) tools, logs each tool call live, then walks you through approving or rejecting staged changes.
- **Plan Mode** — describe a goal; the agent researches read-only, proposes an ordered list of steps with complexity tags, you multi-select which to run, then each selected step runs as its own Agent Mode session.
- **Ask Mode** — ask a question; read-only + web tools only, answer rendered as markdown, with an option to save the Q&A to a file (itself subject to approval).

Picking **Telegram** launches the bot (blocks until `SIGINT`/`SIGTERM`). From Telegram, the owner account can use `/ask <question>`, `/agent <goal>`, and `/plan <goal>` — approvals and plan-step selection happen via inline keyboards.

## Development

```bash
bun test        # 38 tests across core/tools and core/plan
bun run typecheck
```

## License

[MIT](./LICENSE)
