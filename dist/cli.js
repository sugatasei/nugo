#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { Builder } from "./build/Builder.js";
import { ConfigLoader } from "./config/ConfigLoader.js";
import { DevServer } from "./dev/DevServer.js";
const USAGE = `Usage: nugo <command> [options]

Commands:
  build              Build the site into the output directory
  dev                Build, serve and rebuild on change (site URL: http://localhost:<port>)

Options:
  --root <dir>       Site directory (default: current directory)
  --url <url>        Override the site URL (build only)
  --port <port>      Dev server port (default: 3000)`;
async function main() {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            root: { type: "string", default: "." },
            url: { type: "string" },
            port: { type: "string", default: "3000" },
            help: { type: "boolean", short: "h", default: false },
        },
    });
    const root = resolve(values.root);
    const command = positionals[0];
    if (values.help || !command) {
        console.log(USAGE);
        return;
    }
    if (command === "build") {
        const start = performance.now();
        const result = await Builder.run(root, await ConfigLoader.load(root, { url: values.url }));
        console.log(`nugo: ${result.entries.length} entries, ${result.pages.length} pages in ${Math.round(performance.now() - start)} ms`);
        return;
    }
    if (command === "dev") {
        await new DevServer({ root, port: Number(values.port), cli: realpathSync(process.argv[1] ?? "") }).start();
        return;
    }
    throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
}
main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});
