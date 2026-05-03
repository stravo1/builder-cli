import { Command } from "commander";

export const pushCommand = new Command("push")
  .description("Push local changes to remote")
  .action(() => {
    console.log("Pushing...");
    // TODO: upload logic
  });