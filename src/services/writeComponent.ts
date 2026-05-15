import FrappeClient from "../utils/frappeClient";
import { WriteHandler, genericWrite } from "./writeHandler";

const componentHandler: WriteHandler = {
    fetch: (client, name) => client.getComponent(name),
    getDirName: (details) => `${details.component_name}_${details.name}`,
    getJsonFileName: () => "component.json",
    getOptionalFiles: () => [],
    typeLabel: "component",
};

const writeComponent = async (
    client: FrappeClient,
    component: any,
    outputDir: string = "components",
) => {
    return genericWrite(client, component, componentHandler, outputDir);
};

export default writeComponent;
