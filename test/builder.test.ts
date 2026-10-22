import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { z } from "zod";
import { Builder } from "../src/build/Builder.ts";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { search } from "../src/plugins/search.ts";
import { sitemap } from "../src/plugins/sitemap.ts";
import type { ConfigSetup } from "../src/types.ts";

const roots: string[] = [];

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function site(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "nugo-"));
    roots.push(root);

    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }

    return root;
}

async function build(root: string, setup: ConfigSetup) {
    return Builder.run(root, await ConfigLoader.fromSetup(setup));
}

const read = (root: string, path: string): string => readFileSync(join(root, "build", path), "utf-8");

const BASE_FILES = {
    "content/blog/2026/hello/index.md": "---\ntitle: Hello\ndate: 2026-08-20\ncover: cover.png\n---\nHi *there*",
    "content/blog/2026/hello/cover.png": "png",
    "content/blog/2026/older.md": "---\ntitle: Older\ndate: 2026-01-01\n---\nOld",
    "content/pages/about.md": "---\ntitle: About\nnoindex: true\n---\nAbout",
    "public/style.css": "body{}",
    "templates/layouts/base.hbs": "<html>{{> head}}{{{content}}}</html>",
    "templates/partials/head.hbs": "<title>{{title}} | {{site.title}}</title>",
    "templates/post.hbs": "<h1>{{title}}</h1><img src=\"{{cover}}\">{{{entry.html}}}",
    "templates/page.hbs": "<h1>{{title}}</h1>{{{entry.html}}}",
    "templates/list.hbs": "{{#each posts}}<a href=\"{{url}}\">{{data.title}}</a>{{/each}}",
};

const baseSetup: ConfigSetup = (nugo) => {
    nugo.site({ url: "https://example.org", title: "Test" }).layout("layouts/base");
    nugo.collection("posts", {
        dir: "blog",
        schema: z.object({ title: z.string(), date: z.iso.date(), cover: z.string().optional() }),
        template: "post",
        sort: (left, right) => right.data.date.localeCompare(left.data.date),
        assetFields: ["cover"],
    });
    nugo.collection("pages", { dir: "pages", template: "page", layout: false, permalink: (entry) => `/${entry.slug}/` });
    nugo.pages((context) => [{ url: "/", template: "list", data: { title: "Home", posts: context.collection("posts") } }]);
    nugo.use(sitemap());
};

describe("Builder", () => {
    it("renders collections, generated pages, outputs and assets", async () => {
        const root = site(BASE_FILES);
        const result = await build(root, baseSetup);

        assert.equal(result.entries.length, 3);
        assert.equal(
            read(root, "blog/2026/hello/index.html"),
            "<html><title>Hello | Test</title><h1>Hello</h1><img src=\"/blog/2026/hello/cover.png\"><p>Hi <em>there</em></p></html>",
        );
        assert.equal(read(root, "about/index.html"), "<h1>About</h1><p>About</p>");
        assert.equal(
            read(root, "index.html"),
            "<html><title>Home | Test</title><a href=\"/blog/2026/hello/\">Hello</a><a href=\"/blog/2026/older/\">Older</a></html>",
        );
        assert.equal(read(root, "blog/2026/hello/cover.png"), "png");
        assert.equal(read(root, "style.css"), "body{}");
        assert.match(read(root, "sitemap.xml"), /https:\/\/example.org\/blog\/2026\/older\//);
        assert.doesNotMatch(read(root, "sitemap.xml"), /about/);
    });

    it("runs hooks and exposes the build context", async () => {
        const root = site(BASE_FILES);
        const calls: string[] = [];

        await build(root, (nugo) => {
            baseSetup(nugo);
            nugo.on("beforeBuild", (context) => {
                calls.push(`before:${context.entries.length}`);
            });
            nugo.on("afterBuild", (context) => {
                calls.push(`after:${context.entries.length}:${context.pages.length}`);
            });
            nugo.output("data/titles.json", (context) => JSON.stringify(context.entries.map((entry) => entry.data.title)));
        });

        assert.deepEqual(calls, ["before:0", "after:3:4"]);
        assert.equal(read(root, "data/titles.json"), '["Hello","Older","About"]');
    });

    it("reports invalid front matter with the file path", async () => {
        const root = site({ ...BASE_FILES, "content/blog/bad.md": "---\ntitle: Bad\n---\n" });

        await assert.rejects(build(root, baseSetup), /bad\.md has an invalid front matter/);
    });

    it("rejects files outside any collection and duplicate outputs", async () => {
        const stray = site({ ...BASE_FILES, "content/misc/x.md": "x" });
        await assert.rejects(build(stray, baseSetup), /misc\/x\.md does not belong to any collection/);

        const duplicate = site(BASE_FILES);
        await assert.rejects(build(duplicate, (nugo) => {
            baseSetup(nugo);
            nugo.pages(() => [{ url: "/about/", template: "list" }]);
        }), /about\/index\.html has more than one source/);
    });

    it("reports missing templates", async () => {
        const root = site(BASE_FILES);

        await assert.rejects(build(root, (nugo) => {
            baseSetup(nugo);
            nugo.pages(() => [{ url: "/x/", template: "missing" }]);
        }), /Template "missing" not found/);
    });

    it("indexes rendered, indexable entries with Pagefind, one record per section", async () => {
        const root = site({ ...BASE_FILES, "content/blog/2026/older.md": "---\ntitle: Older\ndate: 2026-01-01\n---\nOld\n\n## Part\n\nMore" });

        await build(root, (nugo) => {
            baseSetup(nugo);
            nugo.use(search({ language: "en", filters: (entry) => ({ collection: [entry.collection] }) }));
        });

        assert.ok(existsSync(join(root, "build/pagefind/pagefind-ui.js")));
        // Hello (1 section) + Older (intro + « Part »)
        assert.equal(readdirSync(join(root, "build/pagefind/fragment")).length, 3);
        assert.equal(readdirSync(join(root, "build/pagefind/filter")).length, 1);
    });

    it("overrides the site URL", async () => {
        const root = site(BASE_FILES);
        await Builder.run(root, await ConfigLoader.fromSetup(baseSetup, { url: "http://localhost:3000" }));

        assert.match(read(root, "sitemap.xml"), /<loc>http:\/\/localhost:3000\/blog\/2026\/older\/<\/loc>/);
    });

    it("refuses an output directory containing the site", async () => {
        const root = site(BASE_FILES);

        await assert.rejects(build(root, (nugo) => {
            baseSetup(nugo);
            nugo.dirs({ output: "." });
        }), /cannot contain the site root/);
        assert.ok(existsSync(join(root, "content")));
    });
});
