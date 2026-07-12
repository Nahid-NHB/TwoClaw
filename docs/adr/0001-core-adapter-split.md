# Extract an interface-agnostic core; keep Telegram concrete until a second chat platform exists

CLI and Telegram currently duplicate the agent-session/tool-factory/approval flow, and a second chat platform (Slack/Discord/WhatsApp) is planned next. We're splitting `src/` into `src/core` (agent sessions, tool factories, staging/approval domain logic, plan generation — no Telegraf or `@clack/prompts` dependency) and `src/adapters/{cli,telegram}` (thin, interface-specific rendering on top of core).

We considered designing a generic `ChatAdapter` interface (reply/editMessage/keyboard) now, so Telegram and the next chat platform both implement it from day one. We rejected that: with only one concrete chat implementation, we'd be guessing at the interface shape. We're extracting the core now and will generalize Telegram into a `ChatAdapter` interface only once the second chat platform is actually being built, when there are two real examples to generalize from.
