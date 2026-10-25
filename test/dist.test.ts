import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "..");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

const out = mkdtempSync(join(tmpdir(), "nugo-dist-"));

after(() => rmSync(out, { recursive: true, force: true }));

function files(dir: string): string[] {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1).replaceAll("\\", "/"))
        .sort();
}

// dist/ est versionné pour que les sites l'installent sans compiler : il doit suivre src/
describe("dist", () => {
    it("matches a fresh compilation of src/ (run npm run build)", () => {
        execFileSync(process.execPath, [TSC, "-p", ROOT, "--outDir", out]);
        const dist = join(ROOT, "dist");

        assert.deepEqual(files(dist), files(out));

        // git range dist/ en LF, tsc garde les CRLF des sources extraites sous Windows
        const read = (path: string): string => readFileSync(path, "utf-8").replaceAll("\r\n", "\n");

        for (const file of files(out)) {
            assert.equal(read(join(dist, file)), read(join(out, file)), file);
        }
    });
});
