#!/usr/bin/env bun

import { Command } from "commander";
import { runWakeup } from "./adapters/cli/banner";

const program = new Command();

program
  .name("twoclaw")
  .description("TwoClaw cli tool")
  .version("0.0.1");

program
  .command("wakeup")
  .description("Show the banner and pick cli or telegram mode")
  .action(async () => {
    await runWakeup();
  });

// Bare `twoclaw` with no subcommand previously did nothing; default to wakeup.
if (process.argv.length <= 2) {
  await runWakeup();
} else {
  await program.parseAsync(process.argv);
}
