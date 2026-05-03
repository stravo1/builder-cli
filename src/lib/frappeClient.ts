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
                console.error(
                    response.status,
                    response.statusText ||
                        "Unknown error occurred while testing connection",
                );
                return false;
            }
            return response.ok;
        } catch (error) {
            console.error("Error occurred while testing connection:", error);
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
                console.error(
                    response.status,
                    response.statusText ||
                        "Unknown error occurred while fetching pages",
                );
                return [];
            }
            return (await response.json()).data;
        } catch (error) {
            console.error("Error occurred while fetching pages:", error);
            return [];
        }
    }

    async getPage(pageName: string): Promise<any> {
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
                console.error(
                    response.status,
                    response.statusText ||
                        "Unknown error occurred while fetching page details",
                );
                return null;
            }
            return (await response.json()).data;
        } catch (error) {
            console.error("Error occurred while fetching page details:", error);
            return null;
        }
    }

    async updatePage(
        pageName: string,
        updateMap: Record<string, unknown>,
    ): Promise<any> {
        try {
            const response = await fetch(
                encodeURI(
                    `${this.siteUrl}/api/resource/Builder Page/${pageName}`,
                ),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `token ${this.authToken}`,
                    },
                    body: JSON.stringify(updateMap),
                },
            );
            if (!response.ok) {
                console.error(
                    response.status,
                    response.statusText ||
                        "Unknown error occurred while updating page",
                );
                return null;
            }
            return (await response.json()).data;
        } catch (error) {
            console.error("Error occurred while updating page:", error);
            return null;
        }
    }
}

export default FrappeClient;
