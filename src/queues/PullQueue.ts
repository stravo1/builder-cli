import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";
import writePage from "../services/writePage";
import writeComponent from "../services/writeComponent";
import { BaseQueue } from "./BaseQueue";

type PullHandler = {
    writer: (client: FrappeClient, document: any) => Promise<any>;
    typeLabel: string;
};

export class PullQueue extends BaseQueue {
    private writing: Set<string> = new Set(); // [type]Name -> currently writing

    private handlers: Record<string, PullHandler> = {
        Page: {
            writer: writePage,
            typeLabel: "page",
        },
        Component: {
            writer: writeComponent,
            typeLabel: "component",
        },
    };

    constructor(
        client: FrappeClient,
        type: "Page" | "Component" | "Global",
        debounceDelay: number = 1000,
    ) {
        super(client, type, debounceDelay);
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

    protected async process() {
        if (this.processing || this.queue.size === 0) {
            return;
        }

        this.processing = true;

        try {
            const documents = Array.from(this.queue.values());
            this.queue.clear();

            logger.info(
                `Processing ${documents.length} remote update${documents.length > 1 ? "s" : ""}...`,
            );

            const handler = this.handlers[this.type];
            if (!handler) {
                logger.warn(`Unknown type: ${this.type}`);
                return;
            }

            // Process all items in parallel
            const promises = documents.map((doc) =>
                this.processItem(doc, handler),
            );

            await Promise.all(promises);
        } finally {
            this.processing = false;

            // Check if new items were added during processing
            if (this.queue.size > 0) {
                this.scheduleProcessing();
            }
        }
    }

    private async processItem(document: any, handler: PullHandler) {
        const name = document.name;

        try {
            // Mark as writing
            this.writing.add(name);

            await handler.writer(this.client, document);
            logger.info(`Pulled ${handler.typeLabel}: ${name}`);
        } catch (err) {
            logger.error(
                `Failed to pull ${handler.typeLabel} ${name}: ${(err as Error).message}`,
            );
        } finally {
            // Mark as done writing
            this.writing.delete(name);

            // If document was updated while writing, reprocess immediately with latest version
            if (this.queue.has(name)) {
                logger.info(
                    `[REQUEUE] ${this.type} ${name} has newer updates, reprocessing...`,
                );
                const latestDocument = this.queue.get(name)!;
                this.queue.delete(name);
                // Process immediately without debounce
                await this.processItem(latestDocument, handler);
            }
        }
    }

}


