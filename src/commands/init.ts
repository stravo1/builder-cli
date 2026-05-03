import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { writeFileSync, readFileSync, existsSync } from "fs";
import FrappeClient from "../lib/frappeClient";
import writePage from "../lib/writePage";
import { deleteDir, readDir } from "../utils/file";
import { pull } from "./pull";

const CONFIG_FILE = "config.json";

const displayConfig = (config: Record<string, any>) => {
    console.log(JSON.stringify(config, null, 2));
};

export const initCommand = new Command("init")
    .description(
        "Initialize a local workspace by syncing pages from the server, generating block files, and setting up Git tracking.",
    )
    .requiredOption("-s, --site-name <name>", "Name of the site")
    .requiredOption("-u, --site-url <url>", "URL of the site to connect to")
    .requiredOption(
        "-t, --token <token>",
        "Authentication token for accessing the site",
    )
    .option(
        "-p, --socketio-port <port>",
        "Port number for Socket.IO communication",
    )
    .option(
        "--force",
        "Force initialization even if a config file already exists",
    )
    .option("--only-cli", "No interactive prompts, only use CLI options")
    .action(async (options) => {
        // remove trailing slashes from the end of the site_url if present
        const site_url = options.siteUrl.replace(/\/$/, "");

        try {
            const existingConfig = JSON.parse(
                readFileSync(CONFIG_FILE, "utf-8"),
            );

            console.log("Existing configuration:");
            displayConfig(existingConfig);

            let overwrite = false;
            if (!Boolean(options.force)) {
                if (!Boolean(options.onlyCli)) {
                    overwrite = await confirm({
                        message:
                            "A configuration file already exists. Do you want to overwrite it?",
                    });
                }
            } else {
                overwrite = true;
            }
            if (!overwrite) {
                console.log("Initialization cancelled.");
                return;
            }
        } catch {
            // No existing config file, proceed with initialization
        }
        const newConfig: Record<string, any> = {
            siteUrl: site_url,
            siteName: options.siteName,
            authToken: options.token,
        };

        if (options.socketioPort) {
            newConfig.socketioPort = options.socketioPort;
        }

        writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));

        console.log("New configuration:");
        displayConfig(newConfig);

        const client = new FrappeClient(site_url, options.token);
        const connectionSuccessful = await client.testConnection();
        if (connectionSuccessful) {
            console.log("Connection successful!");
        } else {
            console.error(
                "Failed to connect to the site. Please check your URL and authentication token.",
            );
            return;
        }
        pull(client);
    });
