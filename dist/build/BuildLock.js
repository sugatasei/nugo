import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";
export const LOCK_FILE = ".nugo.lock";
// verrou par site : un seul build à la fois écrit dans le dossier de sortie
export class BuildLock {
    static async with(root, task) {
        const path = join(root, LOCK_FILE);
        this.acquire(path);
        try {
            return await task();
        }
        finally {
            rmSync(path, { force: true });
        }
    }
    static acquire(path) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const fd = openSync(path, "wx");
                writeSync(fd, String(process.pid));
                closeSync(fd);
                return;
            }
            catch (error) {
                if (error.code !== "EEXIST") {
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
    static readPid(path) {
        try {
            return Number(readFileSync(path, "utf-8").trim());
        }
        catch (error) {
            if (error.code === "ENOENT") {
                return undefined;
            }
            throw error;
        }
    }
    static isAlive(pid) {
        if (!Number.isInteger(pid) || pid <= 0) {
            return false;
        }
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (error) {
            return error.code === "EPERM";
        }
    }
}
