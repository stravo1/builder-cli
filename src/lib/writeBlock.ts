import { existsSync } from "fs";
import { deleteDir, makeDir, readDir, writeFile } from "../utils/file";

const writeBlock = async (
    block: Record<string, unknown>,
    outputDir: string,
) => {
    const dirName =
        block.blockId == "root"
            ? `${outputDir}/root`
            : `${outputDir}/${block.blockName || block.element || "unnamed"}_${block.blockId}`;
    const clientScript = block.blockClientScript as string;
    const dataScript = block.blockDataScript as string;

    if (!existsSync(dirName)) {
        makeDir(dirName);
    }

    if (clientScript) {
        const clientScriptPath = `${dirName}/client_script.js`;
        writeFile(clientScriptPath, clientScript);
    }
    if (dataScript) {
        const dataScriptPath = `${dirName}/data_script.py`;
        writeFile(dataScriptPath, dataScript);
    }

    const children = block.children as Record<string, unknown>[];
    if (children && children.length > 0) {
        for (const child of children) {
            await writeBlock(child, dirName);
        }
    }
    // delete blockDirs which are not present in the children list
    // get list of blockDirs in the output directory
    if ((block.children as Record<string, unknown>[]).length > 0) {
        const path = await import("path");
        const blockDirs = readDir(dirName);
        for (const blockDir of blockDirs) {
            // const blockName = blockDir.split("_").slice(-1)[0];
            console.log(
                "Checking block directory:",
                blockDir,
                "against children:",
                children,
            );
            if (
                !children.some(
                    (child: any) =>
                        `${child.blockName || child.element || "unnamed"}_${child.blockId}` ===
                        blockDir,
                )
            ) {
                deleteDir(path.join(dirName, blockDir));
                console.log(
                    `Deleted local directory for removed block: ${blockDir}`,
                );
            }
        }
    }

    block.children = block.children
        ? (block.children as Record<string, unknown>[]).map(
              (child) => child.blockId,
          )
        : [];

    delete block.blockClientScript;
    delete block.blockDataScript;

    const blockDataPath = `${dirName}/block.json`;
    writeFile(blockDataPath, JSON.stringify(block, null, 2));
};

export default writeBlock;
