import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";
import buildPage from "../services/buildPage";
import { readFile, getFileStats } from "../utils/file";
import buildComponent from "../services/buildComponent";
import { BaseQueue } from "./BaseQueue";

type PushHandler = {
    builder: (dir: string) => Promise<any>;
    buildUpdateMap: (builtData: any) => Record<string, unknown>;
    update: (name: string, updateMap: Record<string, unknown>, mtime: string) => Promise<void>;
    getNameKey: (builtData: any) => string;
    nameFieldPath: string;
};

export class PushQueue extends BaseQueue {
    private handlers: Record<string, PushHandler> = {
        Page: {
            builder: buildPage,
            buildUpdateMap: (data) => {
                const updateMap: Record<string, unknown> = {};
                if (data.headHtml !== null) {
                    updateMap.head_html = data.headHtml;
                }
                if (data.bodyHtml !== null) {
                    updateMap.body_html = data.bodyHtml;
                }
                if (data.dataScript !== null) {
                    updateMap.page_data_script = data.dataScript;
                }
                if (data.blocks?.length > 0) {
                    updateMap.draft_blocks = JSON.stringify(data.blocks);
                }
                updateMap.custom_last_sync_client = global.socketId;
                return updateMap;
            },
            update: (name, updateMap, mtime) => this.client.updatePage(name, updateMap, mtime),
            getNameKey: (data) => data.pageData.name,
            nameFieldPath: "pageData.name",
        },
        Component: {
            builder: buildComponent,
            buildUpdateMap: (data) => ({
                block: JSON.stringify(data.block),
            }),
            update: (name, updateMap, mtime) => this.client.updateComponent(name, updateMap, mtime),
            getNameKey: (data) => data.componentData.name,
            nameFieldPath: "componentData.name",
        },
    };

    constructor(
        client: FrappeClient,
        type: "Page" | "Component" | "Global",
        debounceDelay: number = 1000,
    ) {
        super(client, type, debounceDelay);
    }

    add(mainDir: string, fileDir: string) {
        // Remove existing entry for this mainDir, then add new one
        this.queue.delete(mainDir);
        this.queue.set(mainDir, fileDir);
        this.scheduleProcessing();
    }

    protected async process() {
        if (this.processing || this.queue.size === 0) {
            return;
        }

        this.processing = true;

        try {
            logger.info(
                `Processing ${this.queue.size} queued update${this.queue.size > 1 ? "s" : ""}...`,
            );

            const handler = this.handlers[this.type];
            if (!handler) {
                logger.warn(`Unknown type ${this.type} for PushQueue.`);
                this.queue.clear();
                return;
            }

            // Process all items in parallel
            const promises = Array.from(this.queue.entries()).map(
                ([mainDir, fileDir]) =>
                    this.processItem(mainDir, fileDir, handler),
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

    private async processItem(mainDir: string, fileDir: string, handler: PushHandler) {
        try {
            const fileMtime = getFileStats(fileDir)?.mtime.getTime() || 0;
            const storedMtime = readFile(`${mainDir}/.last_modified`);
            if (!storedMtime) {
                logger.info(
                    `No .last_modified file found for ${mainDir}. Skipping update.`,
                );
                return;
            }

            const serverMtime = new Date(storedMtime.trim()).getTime();

            if (fileMtime <= serverMtime) {
                logger.info(
                    `No local changes detected for ${mainDir} since last sync. Skipping update to server.`,
                );
                return;
            }

            const builtData = await handler.builder(mainDir);
            const name: string = handler.getNameKey(builtData) as string;

            if (!name) {
                logger.error(`No name found in ${handler.nameFieldPath} of ${mainDir}`);
                return;
            }

            const updateMap = handler.buildUpdateMap(builtData);
            await handler.update(name, updateMap, storedMtime);
            logger.info(`Updated ${this.type}: ${name}`);
        } catch (err) {
            logger.error(
                `Failed to process ${this.type} ${mainDir}: ${(err as Error).message}`,
            );
        }
    }

}

