import { Command } from "commander";
import { deleteDir, readDir, readFile, fileExists } from "../utils/file";
import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";
import writePage from "../services/writePage";
import writeComponent from "../services/writeComponent";
import path from "node:path";

const CONFIG_FILE = "config.json";

export const pull = async (client: FrappeClient) => {
    try {
        const pages = await client.getPages();
        const pagesDirList = [];
        for (const page of pages) {
            const dirName = await writePage(client, page);
            if (dirName) {
                pagesDirList.push(dirName);
            }
        }

        // delete pageDirs which are not present in the pages list
        const outputDir = path.join(process.cwd(), "pages");
        if (fileExists(outputDir)) {
            const pageDirs = readDir(outputDir);
            for (const pageDir of pageDirs) {
                if (
                    !pagesDirList.some((dirName: string) => dirName === pageDir)
                ) {
                    deleteDir(path.join(outputDir, pageDir));
                    logger.info(
                        `Deleted local directory for removed page: ${path.join(outputDir, pageDir)}`,
                    );
                }
            }
        }

        const components = await client.getComponents();
        const componentsDirList = [];
        for (const component of components) {
            const dirName = await writeComponent(client, component);
            if (dirName) {
                componentsDirList.push(dirName);
            }
        }

        // delete componentDirs which are not present in the components list
        const componentsOutputDir = path.join(process.cwd(), "components");
        if (fileExists(componentsOutputDir)) {
            const componentDirs = readDir(componentsOutputDir);
            for (const componentDir of componentDirs) {
                if (
                    !componentsDirList.some(
                        (dirName: string) => dirName === componentDir,
                    )
                ) {
                    deleteDir(path.join(componentsOutputDir, componentDir));
                    logger.info(
                        `Deleted local directory for removed component: ${path.join(
                            componentsOutputDir,
                            componentDir,
                        )}`,
                    );
                }
            }
        }
    } catch (error) {
        logger.error("Error occurred while fetching pages:", error);
    }
};

export const pullCommand = new Command("pull")
    .description("Manually pull latest data from site")
    .action(() => {
        logger.info("Pulling...");
        const pwd = process.cwd();
        const config = JSON.parse(
            fileExists(CONFIG_FILE) ? readFile(CONFIG_FILE) || "{}" : "{}",
        );
        const client = new FrappeClient(config.siteUrl, config.authToken);
        pull(client);
    });
