import { logger } from "./logger";

class FrappeClient {
    siteUrl: string;
    authToken: string;

    constructor(siteUrl: string, authToken: string) {
        this.siteUrl = siteUrl;
        this.authToken = authToken;
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.siteUrl}/api/method/frappe.auth.get_logged_user`,
                {
                    headers: {
                        Authorization: `token ${this.authToken}`,
                    },
                },
            );
            if (!response.ok) {
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while testing connection"}`,
                );
                return false;
            }
            return response.ok;
        } catch (error) {
            logger.error("Error occurred while testing connection:", error);
            return false;
        }
    }

    async getPages(): Promise<any> {
        try {
            const response = await fetch(
                encodeURI(`${this.siteUrl}/api/resource/Builder Page`),
                {
                    headers: {
                        Authorization: `token ${this.authToken}`,
                    },
                },
            );
            if (!response.ok) {
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while fetching pages"}`,
                );
                return [];
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while fetching pages:", error);
            return [];
        }
    }

    async getPage(pageName: string, fields: string[] = []): Promise<any> {
        try {
            const response = await fetch(
                encodeURI(
                    `${this.siteUrl}/api/resource/Builder Page/${pageName}`,
                ),
                {
                    headers: {
                        Authorization: `token ${this.authToken}`,
                    },
                },
            );
            if (!response.ok) {
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while fetching page details"}`,
                );
                return null;
            }
            if (fields.length > 0) {
                const pageData = (await response.json()).data;
                const filteredData: any = {};
                fields.forEach((field) => {
                    filteredData[field] = pageData[field];
                });
                return filteredData;
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while fetching page details:", error);
            return null;
        }
    }

    async updatePage(
        pageName: string,
        updateMap: Record<string, unknown>,
        lastModified?: string,
    ): Promise<any> {
        try {
            const url = `${this.siteUrl}/api/resource/Builder Page/${pageName}`;
            const method = "PUT";
            const body = {
                ...updateMap,
                source: "cli",
                last_known_server_mtime: lastModified,
            };

            const response = await fetch(encodeURI(url), {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `token ${this.authToken}`,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                logger.debug(JSON.stringify(response));
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while updating page"}`,
                );
                return null;
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while updating page:", error);
            return null;
        }
    }

    async getComponents(): Promise<any> {
        try {
            const response = await fetch(
                encodeURI(`${this.siteUrl}/api/resource/Builder Component`),
                {
                    headers: {
                        Authorization: `token ${this.authToken}`,
                    },
                },
            );
            if (!response.ok) {
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while fetching components"}`,
                );
                return [];
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while fetching components:", error);
            return [];
        }
    }

    async getComponent(
        componentName: string,
        fields: string[] = [],
    ): Promise<any> {
        try {
            const response = await fetch(
                encodeURI(
                    `${this.siteUrl}/api/resource/Builder Component/${componentName}`,
                ),
                {
                    headers: {
                        Authorization: `token ${this.authToken}`,
                    },
                },
            );
            if (!response.ok) {
                logger.error(
                    `${response.status} ${response.statusText || "Unknown error occurred while fetching component"}`,
                );
                return null;
            }
            if (fields.length > 0) {
                const componentData = (await response.json()).data;
                const filteredData: any = {};
                fields.forEach((field) => {
                    filteredData[field] = componentData[field];
                });
                return filteredData;
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while fetching component:", error);
            return null;
        }
    }

    async updateComponent(
        componentName: string,
        updateMap: Record<string, unknown>,
        lastModified?: string,
    ): Promise<any> {
        try {
            const url = `${this.siteUrl}/api/resource/Builder Component/${componentName}`;
            const method = "PUT";
            const body = {
                ...updateMap,
                source: "cli",
                last_known_server_mtime: lastModified,
            };

            const response = await fetch(encodeURI(url), {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `token ${this.authToken}`,
                },
                body: JSON.stringify(body),
            });
            
            if (!response.ok) {
                logger.debug(JSON.stringify(response));
                logger.error(
                    `${response.status} ${response.statusText ||
                    "Unknown error occurred while updating component"
                    }`,
                );
                return null;
            }
            return (await response.json()).data;
        } catch (error) {
            logger.error("Error occurred while updating component:", error);
            return null;
        }
    }
}

export default FrappeClient;
