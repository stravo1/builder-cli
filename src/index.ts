#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { watchCommand } from "./commands/watch";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";

const program = new Command();

program
  .name("builder-cli")
  .description("Builder CLI")
  .version("0.0.1");

program.addCommand(initCommand);
program.addCommand(watchCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.parse();