import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export class OutputWriter {
    private readonly written = new Set<string>();
    private readonly dir: string;

    constructor(dir: string) {
        this.dir = dir;
    }

    // "/a/b/" → a/b/index.html, "/404.html" → 404.html ; les segments encodés sont décodés
    static fileForUrl(url: string): string {
        const segments = url
            .replace(/[?#].*$/, "")
            .split("/")
            .filter(Boolean)
            .map((segment) => decodeURIComponent(segment));

        if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("/"))) {
            throw new Error(`Invalid output URL "${url}"`);
        }

        return url.endsWith("/") ? [...segments, "index.html"].join("/") : segments.join("/");
    }

    write(file: string, content: string | Uint8Array): void {
        writeFileSync(this.reserve(file), content);
    }

    copy(source: string, file: string): void {
        copyFileSync(source, this.reserve(file));
    }

    private reserve(file: string): string {
        if (!file) {
            throw new Error("Output path is empty");
        }

        const outputPath = join(this.dir, file);

        if (this.written.has(outputPath) || existsSync(outputPath)) {
            throw new Error(`${file} has more than one source`);
        }

        this.written.add(outputPath);
        mkdirSync(dirname(outputPath), { recursive: true });

        return outputPath;
    }
}
