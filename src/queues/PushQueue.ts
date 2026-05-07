import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";
import buildPage from "../services/buildPage";
import { readFile, getFileStats } from "../utils/file";
import buildComponent from "../services/buildComponent";

export class PushQueue {
    private queue: Map<string, string> = new Map(); // [type]Dir -> fileDir
    private type: "Page" | "Component" | "Global";
    private processing = false;
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly debounceDelay: number;
    private readonly client: FrappeClient;

    constructor(
        client: FrappeClient,
        type: "Page" | "Component" | "Global",
        debounceDelay: number = 1000,
    ) {
        this.client = client;
        this.type = type;
        this.debounceDelay = debounceDelay;
    }

    add(mainDir: string, fileDir: string) {
        // Remove existing entry for this pageDir, then add new one
        this.queue.delete(mainDir);
        this.queue.set(mainDir, fileDir);
        this.scheduleProcessing();
    }

    private scheduleProcessing() {
        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.process();
        }, this.debounceDelay);
    }

    private async process() {
        if (this.processing || this.queue.size === 0) {
            return;
        }

        this.processing = true;

        try {
            logger.info(
                `Processing ${this.queue.size} queued update${this.queue.size > 1 ? "s" : ""}...`,
            );

            // Process all items in parallel
            const promises = Array.from(this.queue.entries()).map(
                ([mainDir, fileDir]) => {
                    if (this.type === "Page") {
                        return this.processPage(mainDir, fileDir);
                    } else if (this.type === "Component") {
                        return this.processComponent(mainDir, fileDir);
                    } else {
                        logger.warn(
                            `Unknown type ${this.type} for PushQueue. Skipping processing for ${mainDir}.`,
                        );
                        return Promise.resolve();
                    }
                },
            );

            this.queue.clear();

            await Promise.all(promises);
        } finally {
            this.processing = false;

            // Check if new items were added during processing
            if (this.queue.size > 0) {
                this.scheduleProcessing();
            }
        }
    }

    private async processPage(pageDir: string, fileDir: string) {
        try {
            const fileMtime = getFileStats(fileDir)?.mtime.getTime() || 0;
            const storedMtime = readFile(`${pageDir}/.last_modified`);
            if (!storedMtime) {
                logger.info(
                    `No .last_modified file found for ${pageDir}. Skipping update.`,
                );
                return;
            }

            const serverMtime = new Date(storedMtime.trim()).getTime();

            if (fileMtime <= serverMtime) {
                logger.info(
                    `No local changes detected for ${pageDir} since last sync. Skipping update to server.`,
                );
                return;
            }

            const { pageData, headHtml, bodyHtml, dataScript, blocks } =
                await buildPage(pageDir);
            const pageName: string = pageData.name as string;

            if (!pageName) {
                logger.error(`No page name found in page.json of ${pageDir}`);
                return;
            }

            const updateMap: Record<string, unknown> = {};
            if (headHtml !== null) {
                updateMap.head_html = headHtml;
            }
            if (bodyHtml !== null) {
                updateMap.body_html = bodyHtml;
            }
            if (dataScript !== null) {
                updateMap.page_data_script = dataScript;
            }
            if (blocks.length > 0) {
                updateMap.draft_blocks = JSON.stringify(blocks);
            }
            updateMap.custom_last_sync_client = global.socketId;

            await this.client.updatePage(pageName, updateMap, storedMtime);
            logger.info(`Updated page: ${pageName}`);
        } catch (err) {
            logger.error(
                `Failed to process page ${pageDir}: ${(err as Error).message}`,
            );
        }
    }

    private async processComponent(componentDir: string, fileDir: string) {
        try {
            const fileMtime = getFileStats(fileDir)?.mtime.getTime() || 0;
            const storedMtime = readFile(`${componentDir}/.last_modified`);
            if (!storedMtime) {
                logger.info(
                    `No .last_modified file found for ${componentDir}. Skipping update.`,
                );
                return;
            }

            const serverMtime = new Date(storedMtime.trim()).getTime();

            if (fileMtime <= serverMtime) {
                logger.info(
                    `No local changes detected for ${componentDir} since last sync. Skipping update to server.`,
                );
                return;
            }

            const { componentData, block } = await buildComponent(componentDir);
            const componentName: string = componentData.name as string;

            if (!componentName) {
                logger.error(
                    `No component name found in component.json of ${componentDir}`,
                );
                return;
            }

            const updateMap: Record<string, unknown> = {};
            updateMap.block = JSON.stringify(block);

            await this.client.updateComponent(
                componentName,
                updateMap,
                storedMtime,
            );
            logger.info(`Updated component: ${componentName}`);
        } catch (err) {
            logger.error(
                `Failed to process component ${componentDir}: ${(err as Error).message}`,
            );
        }
    }

    async flush() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.process();
    }
}
