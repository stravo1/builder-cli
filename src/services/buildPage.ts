import { readFile, fileExists, readDir } from "../utils/file";
import { Block, readBlocksRecursively } from "./blockBuilder";

interface Page {
    pageData: Record<string, unknown>;
    headHtml: string | null;
    bodyHtml: string | null;
    dataScript: string | null;
    blocks: Block[];
}

const buildPage = async (pageDir: string): Promise<Page> => {
    // Read page.json
    const pageJsonPath = `${pageDir}/page.json`;
    const pageJsonContent = readFile(pageJsonPath);
    const pageData = pageJsonContent ? JSON.parse(pageJsonContent) : {};

    // Read optional files
    const headHtmlPath = `${pageDir}/head.html`;
    const bodyHtmlPath = `${pageDir}/body.html`;
    const dataScriptPath = `${pageDir}/data_script.py`;

    const headHtml = fileExists(headHtmlPath) ? readFile(headHtmlPath) : null;
    const bodyHtml = fileExists(bodyHtmlPath) ? readFile(bodyHtmlPath) : null;
    const dataScript = fileExists(dataScriptPath)
        ? readFile(dataScriptPath)
        : null;

    // Read blocks recursively
    const blocksDir = `${pageDir}/blocks/root`;
    const blocks: Block[] = [];

    // Read all blocks starting from root
    if (fileExists(blocksDir)) {
        const rootBlock = readBlocksRecursively(blocksDir);
        if (rootBlock) {
            blocks.push(rootBlock);
        }
    }

    return {
        pageData,
        headHtml,
        bodyHtml,
        dataScript,
        blocks,
    };
};

export default buildPage;