import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";

export const LOCK_FILE = ".nugo.lock";

// verrou par site : un seul build à la fois écrit dans le dossier de sortie
export class BuildLock {
    static async with<T>(root: string, task: () => Promise<T>): Promise<T> {
        const path = join(root, LOCK_FILE);
        this.acquire(path);

        try {
            return await task();
        } finally {
            rmSync(path, { force: true });
        }
    }

    private static acquire(path: string): void {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const fd = openSync(path, "wx");
                writeSync(fd, String(process.pid));
                closeSync(fd);
                return;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                    throw error;
                }
            }

            const pid = this.readPid(path);

            // verrou libéré entre-temps
            if (pid === undefined) {
                continue;
            }

            if (this.isAlive(pid)) {
                throw new Error(`Another nugo build is already running for this site (pid ${pid}, lock ${path})`);
            }

            // verrou laissé par un build interrompu
            rmSync(path, { force: true });
        }

        throw new Error(`Cannot acquire the build lock ${path}`);
    }

    private static readPid(path: string): number | undefined {
        try {
            return Number(readFileSync(path, "utf-8").trim());
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return undefined;
            }

            throw error;
        }
    }

    private static isAlive(pid: number): boolean {
        if (!Number.isInteger(pid) || pid <= 0) {
            return false;
        }

        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return (error as NodeJS.ErrnoException).code === "EPERM";
        }
    }
}
