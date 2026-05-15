import { logger } from "../utils/logger";
import FrappeClient from "../utils/frappeClient";

export abstract class BaseQueue {
    protected queue: Map<string, any> = new Map();
    protected type: "Page" | "Component" | "Global";
    protected processing = false;
    protected debounceTimer: NodeJS.Timeout | null = null;
    protected readonly debounceDelay: number;
    protected readonly client: FrappeClient;

    constructor(
        client: FrappeClient,
        type: "Page" | "Component" | "Global",
        debounceDelay: number = 1000,
    ) {
        this.client = client;
        this.type = type;
        this.debounceDelay = debounceDelay;
    }

    protected scheduleProcessing() {
        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.process();
        }, this.debounceDelay);
    }

    protected abstract process(): Promise<void>;

    async flush() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.process();
    }
}
