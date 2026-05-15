import { makeDir, writeFile, fileExists } from "../utils/file";
import FrappeClient from "../utils/frappeClient";
import writeBlock from "./writeBlock";
import { safeFileName } from "../utils/misc";
import { logger } from "../utils/logger";

export interface WriteHandler {
    fetch: (client: FrappeClient, name: string) => Promise<any>;
    getDirName: (details: any) => string;
    getJsonFileName: () => string;
    getOptionalFiles?: (details: any, itemDir: string) => Array<{
        path: string;
        content: string;
    }>;
    cleanupDetails?: (details: any) => void;
    typeLabel: string;
}

export const genericWrite = async (
    client: FrappeClient,
    document: any,
    handler: WriteHandler,
    outputDir: string,
): Promise<string | null> => {
    logger.info(`Writing ${handler.typeLabel}: ${document.name}`);

    const details = await handler.fetch(client, document.name);
    if (!details) {
        logger.error(`Failed to fetch details for ${handler.typeLabel}: ${document.name}`);
        return null;
    }

    // Create directory
    const dirName = safeFileName(handler.getDirName(details));
    const pwd = process.cwd();
    const itemDir = `${pwd}/${outputDir}/${dirName}`;

    if (!fileExists(itemDir)) {
        makeDir(itemDir);
    }

    // Write blocks
    const draftBlocks = details.draft_blocks;
    const blocks = JSON.parse(draftBlocks || details.blocks || "[]");
    for (const block of blocks) {
        await writeBlock(block, `${itemDir}/blocks`, details.modified);
    }

    // Cleanup blocks from details
    delete details.draft_blocks;
    delete details.blocks;

    // Write main JSON file
    writeFile(
        `${itemDir}/${handler.getJsonFileName()}`,
        JSON.stringify(details, null, 2),
        details.modified,
    );

    // Write optional files
    const optionalFiles = handler.getOptionalFiles?.(details, itemDir) || [];
    for (const file of optionalFiles) {
        writeFile(file.path, file.content, details.modified);
    }

    // Write last modified timestamp
    writeFile(
        `${itemDir}/.last_modified`,
        details.modified,
        details.modified,
    );

    logger.info(`Successfully wrote ${handler.typeLabel}: ${dirName}`);
    return dirName;
};
