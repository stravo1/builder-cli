import { Command } from "commander";
import { io } from "socket.io-client";
import { readFile } from "../utils/file";
import { logger, log, c } from "../utils/logger";
import chokidar from "chokidar";
import FrappeClient from "../lib/frappeClient";
import writePage from "../lib/writePage";
import path from "path";
import buildPage from "../lib/buildPage";
import { getFileStats } from "../utils/file";
import { pull } from "./pull";

const CONFIG_FILE = "config.json";

// Push queue and debounce utilities
class PushQueue {
    private queue: Map<string, string> = new Map(); // pageDir -> pageDir (dedupe)
    private processing = false;
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly debounceDelay: number;
    private readonly client: FrappeClient;

    constructor(client: FrappeClient, debounceDelay: number = 1000) {
        this.client = client;
        this.debounceDelay = debounceDelay;
    }

    add(pageDir: string) {
        // Remove existing entry for this pageDir, then add new one
        this.queue.delete(pageDir);
        this.queue.set(pageDir, pageDir);
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
            const pageDirs = Array.from(this.queue.values());
            this.queue.clear();

            logger.info(
                `Processing ${pageDirs.length} queued update${pageDirs.length > 1 ? "s" : ""}...`,
            );

            // Process all items in parallel
            const promises = pageDirs.map((pageDir) => this.processPage(pageDir));

            await Promise.all(promises);
        } finally {
            this.processing = false;

            // Check if new items were added during processing
            if (this.queue.size > 0) {
                this.scheduleProcessing();
            }
        }
    }

    private async processPage(pageDir: string) {
        try {
            const fileMtime = getFileStats(pageDir)?.mtime.getTime() || 0;
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
                logger.error(
                    `No page name found in page.json of ${pageDir}`,
                );
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
            logger.info(`✓ Updated page: ${pageName}`);
        } catch (err) {
            logger.error(`✗ Failed to process page ${pageDir}: ${(err as Error).message}`);
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

// Pull queue for batching remote updates
class PullQueue {
    private queue: Map<string, any> = new Map(); // pageName -> page
    private processing = false;
    private writing: Set<string> = new Set(); // pageName -> currently writing
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly debounceDelay: number;
    private readonly client: FrappeClient;

    constructor(client: FrappeClient, debounceDelay: number = 1000) {
        this.client = client;
        this.debounceDelay = debounceDelay;
    }

    add(page: any) {
        // If page is currently being written, replace with latest version
        // It will be reprocessed after current write completes
        this.queue.delete(page.name);
        this.queue.set(page.name, page);

        // If this page is currently being written, we'll reprocess after write completes
        if (this.writing.has(page.name)) {
            logger.info(`[QUEUE] Page ${page.name} updated while writing, will reprocess with latest version`);
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
            const promises = pages.map((page) => this.processPage(page));

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
            logger.info(`✓ Pulled page: ${pageName}`);
        } catch (err) {
            logger.error(`✗ Failed to pull page ${pageName}: ${(err as Error).message}`);
        } finally {
            // Mark as done writing
            this.writing.delete(pageName);

            // If page was updated while writing, reprocess immediately with latest version
            if (this.queue.has(pageName)) {
                logger.info(`[REQUEUE] Page ${pageName} has newer updates, reprocessing...`);
                const latestPage = this.queue.get(pageName)!;
                this.queue.delete(pageName);
                // Process immediately without debounce
                await this.processPage(latestPage);
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

const watchLocalChanges = (client: FrappeClient) => {
    const WATCH_PATHS = ["pages", "components", "globals"];
    const pushQueue = new PushQueue(client, 1000); // 1s debounce delay

    const watcher = chokidar.watch(WATCH_PATHS, {
        persistent: true,
        ignoreInitial: true, // don't fire for existing files on startup
        ignored: [
            /(^|[\/\\])\../, // ignore dotfiles
            /\.log$/i,
            /\.json$/i,
            /\.tmp$/i,
            /\.DS_Store/,
        ],
        awaitWriteFinish: {
            stabilityThreshold: 200, // wait 200ms after last change before firing
            pollInterval: 100,
        },
    });

    const abs = (filePath: string) => path.resolve(filePath);

    watcher
        .on("add", (p) => logger.info(`[ADD]    ${abs(p)}`))
        .on("unlink", (p) => logger.info(`[DELETE] ${abs(p)}`))
        .on("addDir", (p) => logger.info(`[MKDIR]  ${abs(p)}`))
        .on("unlinkDir", (p) => logger.info(`[RMDIR]  ${abs(p)}`))
        .on("error", (e) => logger.error(`[ERROR]  ${e}`))
        .on("ready", () =>
            logger.info(
                `Watching: ${WATCH_PATHS.map((p) => path.resolve(p)).join(", ")}\n`,
            ),
        )
        .on("change", async (p) => {
            logger.info(`[CHANGE] ${p}`);

            const pwd = process.cwd();
            const isChangeInPages = p.startsWith("pages/");
            if (!isChangeInPages) {
                logger.info(
                    `Change detected in ${p}, but it's outside the pages directory. Ignoring.`,
                );
                return;
            }

            const pageDir = path.resolve(
                `${pwd}/${p.match(/^(pages\/[^\/]+\/)/)![0]}`,
            );

            if (pageDir) {
                // Queue only pageDir; processor handles all logic
                pushQueue.add(pageDir);
            }
        });
};

const watchRemoteChanges = (config: any, client: FrappeClient) => {
    const pullQueue = new PullQueue(client, 1000); // 1s debounce delay
    
    let url;
    let urlObject = new URL(config.siteUrl);
    let secure = urlObject.protocol === "https:";
    if (config.socketioPort) {
        urlObject.port = config.socketioPort;
    }
    url = `${urlObject.toString()}${config.siteName}`;
    logger.info(`Connecting to Socket.IO server at ${url}...`);

    const socket = io(url, {
        withCredentials: true,
        secure: secure,
        extraHeaders: {
            origin: config.siteUrl,
            Authorization: `token ${config.authToken}`,
        },
    });
    socket.on("connect", () => {
        logger.info(
            `[CONNECTED] Socket ID: ${c.bold}${socket.id}${c.reset}`,
        );
        global.socketId = socket.id!;
        socket?.emit("doctype_subscribe", "Builder Page");
    });

    socket.on("disconnect", (reason) => {
        logger.error(`[DISCONNECTED] ${reason}`);
    });

    socket.on("connect_error", (err) => {
        logger.error(`[CONNECTION ERROR] ${err.message}`);
    });

    socket.on("error", (err) => {
        logger.error(`[SOCKET ERROR] ${err}`);
    });

    socket.on("list_update", (page) => {
        logger.info(`[PAGE UPDATE] ${c.bold}${page.name}${c.reset}`);
        pullQueue.add(page);
    });
};

export const watchCommand = new Command("watch")
    .description(
        "Watch for local and server changes, sync updates in real time, and manage Git merges automatically.",
    )
    .option("--only-local", "Watch only local file changes and sync to server")
    .option("--only-remote", "Watch only remote changes and sync to local")
    .action(async (options) => {
        logger.info("Starting watch mode...");
        const config = readFile(CONFIG_FILE);
        if (!config) {
            logger.error(
                "No configuration found. Please run the init command first.",
            );
            return;
        }

        const { siteUrl, authToken, socketioPort, siteName } =
            JSON.parse(config);

        const client = new FrappeClient(siteUrl, authToken);
        client.testConnection().then((isConnected) => {
            if (!isConnected) {
                logger.error(
                    "Failed to connect to the site. Please check your configuration and try again.",
                );
                return;
            }
            logger.info("Connection to site successful. Initializing watchers...");
        });
        if (!options.onlyLocal) {
            await pull(client);
            watchRemoteChanges(
                { siteUrl, authToken, socketioPort, siteName },
                client,
            );
        }
        if (!options.onlyRemote) {
            watchLocalChanges(client);
        }
    });
