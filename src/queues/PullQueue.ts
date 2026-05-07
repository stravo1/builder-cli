import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";
import writePage from "../services/writePage";
import writeComponent from "../services/writeComponent";

export class PullQueue {
    private queue: Map<string, any> = new Map(); // [type]Name -> info
    private processing = false;
    type: "Page" | "Component" | "Global";
    private writing: Set<string> = new Set(); // [type]Name -> currently writing
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

    add(document: any) {
        // If ${this.type} is currently being written, replace with latest version
        // It will be reprocessed after current write completes
        this.queue.delete(document.name);
        this.queue.set(document.name, document);

        // If this ${this.type} is currently being written, we'll reprocess after write completes
        if (this.writing.has(document.name)) {
            logger.info(
                `[QUEUE] ${this.type} ${document.name} updated while writing, will reprocess with latest version`,
            );
        }

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
            const pages = Array.from(this.queue.values());
            this.queue.clear();

            logger.info(
                `Processing ${pages.length} remote update${pages.length > 1 ? "s" : ""}...`,
            );

            // Process all items in parallel
            const promises = pages.map((page) => {
                if (this.type === "Page") {
                    return this.processPage(page);
                } else if (this.type === "Component") {
                    return this.processComponent(page);
                } else {
                    logger.warn(`Unknown type: ${this.type}`);
                    return Promise.resolve();
                }
            });

            await Promise.all(promises);
        } finally {
            this.processing = false;

            // Check if new items were added during processing
            if (this.queue.size > 0) {
                this.scheduleProcessing();
            }
        }
    }

    private async processPage(page: any) {
        const pageName = page.name;

        try {
            // Mark as writing
            this.writing.add(pageName);

            await writePage(this.client, page);
            logger.info(`Pulled page: ${pageName}`);
        } catch (err) {
            logger.error(
                `Failed to pull page ${pageName}: ${(err as Error).message}`,
            );
        } finally {
            // Mark as done writing
            this.writing.delete(pageName);

            // If page was updated while writing, reprocess immediately with latest version
            if (this.queue.has(pageName)) {
                logger.info(
                    `[REQUEUE] Page ${pageName} has newer updates, reprocessing...`,
                );
                const latestPage = this.queue.get(pageName)!;
                this.queue.delete(pageName);
                // Process immediately without debounce
                await this.processPage(latestPage);
            }
        }
    }

    private async processComponent(component: any) {
        const componentName = component.name;

        try {
            // Mark as writing
            this.writing.add(componentName);

            await writeComponent(this.client, component);
            logger.info(`Pulled component: ${componentName}`);
        } catch (err) {
            logger.error(
                `Failed to pull component ${componentName}: ${(err as Error).message}`,
            );
        } finally {
            // Mark as done writing
            this.writing.delete(componentName);

            // If component was updated while writing, reprocess immediately with latest version
            if (this.queue.has(componentName)) {
                logger.info(
                    `[REQUEUE] Component ${componentName} has newer updates, reprocessing...`,
                );
                const latestComponent = this.queue.get(componentName)!;
                this.queue.delete(componentName);
                // Process immediately without debounce
                await this.processComponent(latestComponent);
            }
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
