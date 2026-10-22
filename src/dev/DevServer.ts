import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ConfigLoader } from "../config/ConfigLoader.ts";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf",
};

const RELOAD_PATH = "/__nugo/reload";
const RELOAD_SCRIPT = `<script>new EventSource("${RELOAD_PATH}").onmessage = () => location.reload();</script>`;
const IGNORED = new Set(["node_modules", ".git"]);

export interface DevServerOptions {
    readonly root: string;
    readonly port: number;
    readonly cli: string;
}

export class DevServer {
    private readonly clients = new Set<ServerResponse>();
    private readonly options: DevServerOptions;
    private outputDir = "";
    private building = false;
    private pending = false;
    private timer?: NodeJS.Timeout;

    constructor(options: DevServerOptions) {
        this.options = options;
    }

    async start(): Promise<void> {
        const config = await ConfigLoader.load(this.options.root);
        this.outputDir = resolve(this.options.root, config.dirs.output);

        await this.build();
        createServer((request, response) => this.handle(request, response))
            .listen(this.options.port, () => console.log(`nugo: http://localhost:${this.options.port}/`));

        const outputPath = relative(this.options.root, this.outputDir);

        watch(this.options.root, { recursive: true }, (_event, filename) => {
            if (!filename) {
                return;
            }

            const parts = filename.split(sep);

            if (parts.some((part) => IGNORED.has(part)) || (outputPath && `${filename}${sep}`.startsWith(`${outputPath}${sep}`))) {
                return;
            }

            clearTimeout(this.timer);
            this.timer = setTimeout(() => void this.build(), 100);
        });
    }

    // chaque build tourne dans un processus neuf : la config et les plugins du site sont relus à chaque fois
    private async build(): Promise<void> {
        if (this.building) {
            this.pending = true;
            return;
        }

        this.building = true;
        const success = await new Promise<boolean>((done) => {
            spawn(process.execPath, [
                this.options.cli, "build",
                "--root", this.options.root,
                "--url", `http://localhost:${this.options.port}`,
            ], { stdio: "inherit" })
                .on("exit", (code) => done(code === 0));
        });
        this.building = false;

        if (success) {
            for (const client of this.clients) {
                client.write("data: reload\n\n");
            }
        }

        if (this.pending) {
            this.pending = false;
            await this.build();
        }
    }

    private handle(request: IncomingMessage, response: ServerResponse): void {
        const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);

        if (pathname === RELOAD_PATH) {
            response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
            response.write("\n");
            this.clients.add(response);
            request.on("close", () => this.clients.delete(response));
            return;
        }

        let filePath = resolve(this.outputDir, `.${pathname}`);
        const inside = relative(this.outputDir, filePath);

        if (inside.startsWith("..") || isAbsolute(inside)) {
            response.writeHead(403).end();
            return;
        }

        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
            if (!pathname.endsWith("/")) {
                response.writeHead(301, { Location: `${pathname}/` }).end();
                return;
            }

            filePath = join(filePath, "index.html");
        }

        if (existsSync(filePath) && statSync(filePath).isFile()) {
            this.send(response, 200, filePath);
            return;
        }

        const notFound = join(this.outputDir, "404.html");

        if (existsSync(notFound)) {
            this.send(response, 404, notFound);
        } else {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        }
    }

    private send(response: ServerResponse, status: number, filePath: string): void {
        const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";

        if (extname(filePath).toLowerCase() === ".html") {
            const html = readFileSync(filePath, "utf-8");
            const body = html.includes("</body>") ? html.replace("</body>", `${RELOAD_SCRIPT}</body>`) : html + RELOAD_SCRIPT;
            response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);
            return;
        }

        response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
        createReadStream(filePath).pipe(response);
    }
}
