import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export class FileSystem {
    static getFiles(dir: string): string[] {
        if (!existsSync(dir) || !statSync(dir).isDirectory()) {
            return [];
        }

        return this.collectFiles(dir);
    }

    static removeDirectory(dir: string): void {
        rmSync(dir, { recursive: true, force: true });
    }

    static createDirectory(dir: string): void {
        mkdirSync(dir, { recursive: true });
    }

    static copy(source: string, destination: string): void {
        if (!existsSync(source)) {
            throw new Error(`${source} not found`);
        }

        mkdirSync(dirname(destination), { recursive: true });
        cpSync(source, destination, { recursive: true });
    }

    private static collectFiles(dir: string): string[] {
        const files: string[] = [];

        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                files.push(...this.collectFiles(fullPath));
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }
}
