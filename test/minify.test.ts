import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { Builder } from "../src/build/Builder.ts";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { minify, type MinifyOptions } from "../src/plugins/minify.ts";

const roots: string[] = [];

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const SCRIPT = "// commentaire\nconst message = \"bonjour\";\n\nexport function greet() {\n    return message;\n}\n";
const STYLE = "/*! licence */\nbody {\n    color: red;\n}\n\n@media (width >= 40rem) {\n    body { color: blue; }\n}\n";

function site(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "nugo-minify-"));
    roots.push(root);

    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }

    return root;
}

const build = async (root: string, options?: MinifyOptions) => Builder.run(root, await ConfigLoader.fromSetup((nugo) => {
    nugo.site({ url: "https://example.org" });
    nugo.output("site.css", () => STYLE);
    nugo.use(minify(options));
}));
const read = (root: string, path: string): string => readFileSync(join(root, "build", path), "utf-8");

describe("minify", () => {
    it("minifies the JS and CSS of public/ and of outputs, keeping licence comments", async () => {
        const root = site({ "public/app.js": SCRIPT, "public/app.mjs": SCRIPT, "public/notes.txt": SCRIPT });

        await build(root);

        assert.equal(read(root, "app.js"), "const e=\"bonjour\";export function greet(){return e}\n");
        assert.equal(read(root, "app.mjs"), read(root, "app.js"));
        assert.equal(read(root, "site.css"), "/*! licence */body{color:red}@media(width>=40rem){body{color:#00f}}\n");
        assert.equal(read(root, "notes.txt"), SCRIPT);
    });

    it("leaves *.min.* files and excluded URLs untouched", async () => {
        const root = site({ "public/lib.min.js": SCRIPT, "public/pagefind/ui.js": SCRIPT, "public/vendor/x.js": SCRIPT });

        await build(root);
        assert.equal(read(root, "lib.min.js"), SCRIPT);
        assert.equal(read(root, "pagefind/ui.js"), SCRIPT);
        assert.notEqual(read(root, "vendor/x.js"), SCRIPT);

        await build(root, { exclude: ["/vendor/"] });
        assert.equal(read(root, "vendor/x.js"), SCRIPT);
        assert.notEqual(read(root, "pagefind/ui.js"), SCRIPT);
    });

    it("names the file that cannot be minified", async () => {
        const root = site({ "public/broken.js": "const = ;" });

        await assert.rejects(build(root), /Cannot minify .*broken\.js/);
    });
});
