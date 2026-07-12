import { marked, type MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";

let ready = false;

function ensureMarked(): void {
  if (ready) return;
  const w = Math.max(40, Math.min(process.stdout.columns || 80, 120));
  // marked-terminal's TerminalRenderer (a marked.Renderer subclass) predates marked's
  // current RendererObject-based extension API; the two shapes don't structurally
  // match even though this is exactly the usage marked-terminal's own docs recommend.
  marked.use(markedTerminal({ width: w, reflowText: true }, {}) as unknown as MarkedExtension);
  ready = true;
}

export function renderTerminalMarkdown(source: string): string {
  ensureMarked();
  return marked.parse(source.trimEnd(), { async: false }) as string;
}
