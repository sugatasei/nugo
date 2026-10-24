import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { Builder } from "../src/build/Builder.ts";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { fingerprint } from "../src/plugins/fingerprint.ts";
import { minify } from "../src/plugins/minify.ts";

const roots: string[] = [];

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const PAGE = [
    "<link rel=\"stylesheet\" href=\"/site.css\">",
    "<script src=\"/app.js\"></script>",
    "<script src=\"/missing.js\"></script>",
    "<script src=\"https://example.com/x.js\"></script>",
    "<script src=\"//cdn.example.com/y.js\"></script>",
    "<script src=\"/app.js?v=manual\"></script>",
    "<a href=\"/notes.txt\">notes</a>",
    "<a href=\"/\">accueil</a>",
].join("\n");

function site(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "nugo-fingerprint-"));
    roots.push(root);

    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }

    return root;
}

const hash = (content: string): string => createHash("sha256").update(content).digest("hex").slice(0, 10);
const read = (root: string, path: string): string => readFileSync(join(root, "build", path), "utf-8");

describe("fingerprint", () => {
    it("versions local JS and CSS URLs of every page with the hash of the final file", async () => {
        const root = site({
            "public/app.js": "const message = 1;\nconsole.log(message);\n",
            "public/notes.txt": "notes",
            "templates/home.hbs": PAGE,
        });

        await Builder.run(root, await ConfigLoader.fromSetup((nugo) => {
            nugo.site({ url: "https://example.org" });
            nugo.pages(() => [{ url: "/", template: "home" }, { url: "/a/b/", template: "home" }]);
            nugo.output("site.css", () => "body { color: red; }");
            nugo.use(minify()).use(fingerprint());
        }));

        const js = hash(read(root, "app.js"));
        const css = hash(read(root, "site.css"));
        const expected = [
            `<link rel="stylesheet" href="/site.css?v=${css}">`,
            `<script src="/app.js?v=${js}"></script>`,
            "<script src=\"/missing.js\"></script>",
            "<script src=\"https://example.com/x.js\"></script>",
            "<script src=\"//cdn.example.com/y.js\"></script>",
            "<script src=\"/app.js?v=manual\"></script>",
            "<a href=\"/notes.txt\">notes</a>",
            "<a href=\"/\">accueil</a>",
        ].join("\n");

        // empreinte du fichier minifié
        assert.doesNotMatch(read(root, "app.js"), /\n./);
        assert.equal(read(root, "index.html"), expected);
        assert.equal(read(root, "a/b/index.html"), expected);
    });
});
