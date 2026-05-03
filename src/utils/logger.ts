const c = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    bold: "\x1b[1m",
    reset: "\x1b[0m",
};

const log = (type: "response" | "error", message: string) => {
    const timestamp = new Date().toISOString();
    if (type === "response") {
        console.log(`${c.green}[${timestamp}] ${message}${c.reset}`);
    } else if (type === "error") {
        console.error(`${c.red}[${timestamp}] ${message}${c.reset}`);
    }
};

export { log, c };
