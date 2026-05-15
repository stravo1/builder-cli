import FrappeClient from "../utils/frappeClient";
import { WriteHandler, genericWrite } from "./writeHandler";

const pageHandler: WriteHandler = {
    fetch: (client, name) => client.getPage(name),
    getDirName: (details) => `${details.page_title}_${details.name}`,
    getJsonFileName: () => "page.json",
    getOptionalFiles: (details, itemDir) => {
        const files: Array<{ path: string; content: string }> = [];

        if (details.page_data_script) {
            files.push({
                path: `${itemDir}/data_script.py`,
                content: details.page_data_script,
            });
        }
        if (details.head_html) {
            files.push({
                path: `${itemDir}/head.html`,
                content: details.head_html,
            });
        }
        if (details.body_html) {
            files.push({
                path: `${itemDir}/body.html`,
                content: details.body_html,
            });
        }
        return files;
    },
    typeLabel: "page",
};

const writePage = async (
    client: FrappeClient,
    page: any,
    outputDir: string = "pages",
) => {
    return genericWrite(client, page, pageHandler, outputDir);
};

export default writePage;
