import { readFile, fileExists, readDir } from "../utils/file";
import { Block, readBlocksRecursively } from "./blockBuilder";

interface Component {
    componentData: Record<string, unknown>;
    block: Block | null;
}

const buildComponent = async (componentDir: string): Promise<Component> => {
    // Read component.json
    const componentJsonPath = `${componentDir}/component.json`;
    const componentJsonContent = readFile(componentJsonPath);
    const componentData = componentJsonContent ? JSON.parse(componentJsonContent) : {};


    // Read blocks recursively
    const blocksDir = `${componentDir}/blocks/`;
    const componentRootDir = readDir(blocksDir)[0]; // Component can have only one root block
    let rootBlock: Block | null = null;

    // Read all blocks starting from root
    if (fileExists(`${blocksDir}/${componentRootDir}`)) {
        rootBlock = readBlocksRecursively(`${blocksDir}/${componentRootDir}`);
    }

    return {
        componentData,
        block: rootBlock,
    };
};

export default buildComponent;