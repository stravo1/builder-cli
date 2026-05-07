import { makeDir, writeFile, fileExists } from "../utils/file";
import FrappeClient from "../utils/frappeClient";
import writeBlock from "./writeBlock";
import { safeFileName } from "../utils/misc";
import { logger } from "../utils/logger";

const writeComponent = async (
    client: FrappeClient,
    component: any,
    outputDir: string = "components",
) => {
    logger.info(`Writing component: ${component.name}`);
    const componentDetails = await client.getComponent(component.name);
    if (componentDetails) {
        if (
            global.lastSyncTimestamp !== "" &&
            componentDetails.modified === global.lastSyncTimestamp &&
            componentDetails.custom_last_sync_client === global.socketId
        ) {
            logger.info(
                `No changes detected for component: ${component.name}. Skipping write.`,
            );
            return;
        }
        // Write component details to a file in the output directory
        const dirName = safeFileName(
            `${componentDetails.component_name}_${componentDetails.name}`,
        );

        const pwd = process.cwd();
        const componentDir = `${pwd}/${outputDir}/${dirName}`;

        // check if componentDir already exists, create if not
        if (!fileExists(componentDir)) {
            makeDir(componentDir);
        }

        const block = JSON.parse(componentDetails.block || "{}");
        await writeBlock(
            block,
            `${componentDir}/blocks`,
            componentDetails.modified,
        );

        delete componentDetails.draft_blocks;
        delete componentDetails.blocks;

        writeFile(
            `${componentDir}/component.json`,
            JSON.stringify(componentDetails, null, 2),
            componentDetails.modified,
        );

        // write component last modified timestamp to a file
        writeFile(
            `${componentDir}/.last_modified`,
            componentDetails.modified,
            componentDetails.modified,
        );
        return dirName;
    } else {
        logger.error(
            `Failed to fetch details for component: ${component.name}`,
        );
        return null;
    }
};

export default writeComponent;
