import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { OutputWriter } from "../src/build/OutputWriter.ts";
import { FrontMatter } from "../src/content/FrontMatter.ts";
import { MarkdownRenderer } from "../src/markdown/MarkdownRenderer.ts";

const ENTRY = { collection: "posts", src: "a.md", slug: "a", data: {}, url: "/a/" };

describe("FrontMatter", () => {
    it("parses YAML and keeps line positions", () => {
        const { data, body } = FrontMatter.parse("---\ntitle: Hello\ntags: [a]\n---\n# Body", "a.md");

        assert.deepEqual(data, { title: "Hello", tags: ["a"] });
        assert.equal(body, "\n\n\n\n# Body");
    });

    it("accepts files without or with an empty front matter", () => {
        assert.deepEqual(FrontMatter.parse("text", "a.md"), { data: {}, body: "text" });
        assert.deepEqual(FrontMatter.parse("---\n---\ntext", "a.md").data, {});
    });

    it("supports custom delimiters", () => {
        const { data, body } = FrontMatter.parse("<!--\ntitle: Hello\n-->\nText", "a.md", ["<!--", "-->"]);

        assert.deepEqual(data, { title: "Hello" });
        assert.equal(body, "\n\n\nText");
        assert.deepEqual(FrontMatter.parse("---\ntitle: x\n---\n", "a.md", ["<!--", "-->"]).data, {});
    });

    it("rejects non-mapping front matter", () => {
        assert.throws(() => FrontMatter.parse("---\n- a\n---\n", "a.md"), /YAML mapping/);
    });
});

describe("MarkdownRenderer", () => {
    it("drops author HTML unless enabled", async () => {
        const strict = new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [], []);
        const loose = new MarkdownRenderer({ gfm: true, html: true, headingIds: true }, [], []);

        assert.equal((await strict.render("a <b>b</b>", "a.md", ENTRY)).html, "<p>a b</p>");
        assert.equal((await loose.render("a <b>b</b>", "a.md", ENTRY)).html, "<p>a <b>b</b></p>");
    });

    it("runs site plugins, keeps their HTML and exposes file data as meta", async () => {
        const plugin = () => async (tree: Root, file: VFile) => {
            visit(tree, "text", (node, index, parent) => {
                if (parent && index !== undefined && node.value === "@") {
                    parent.children.splice(index, 1, { type: "html", value: "<i>at</i>" });
                }
            });
            file.data.seen = file.data.entry?.url;
        };
        const renderer = new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [plugin], []);
        const result = await renderer.render("@", "a.md", ENTRY);

        assert.equal(result.html, "<p><i>at</i></p>");
        assert.deepEqual(result.meta, { seen: "/a/" });
    });
});

declare module "vfile" {
    interface DataMap {
        seen: string;
    }
}

describe("MarkdownRenderer text", () => {
    it("extracts plain text after plugins, using searchText for plugin HTML", async () => {
        const plugin = () => (tree: Root) => {
            visit(tree, "text", (node, index, parent) => {
                if (parent && index !== undefined && node.value === "@") {
                    parent.children.splice(index, 1, { type: "html", value: "<b>x</b>", data: { searchText: "Arobase" } });
                }
            });
            tree.children.push({ type: "html", value: "<ul></ul>", data: { searchText: "Bloc" } }, { type: "paragraph", children: [{ type: "text", value: "Fin" }] });
        };
        const renderer = new MarkdownRenderer({ gfm: true, html: true, headingIds: true }, [plugin], []);
        const { text } = await renderer.render("## Titre\n\nUn *mot* et `code` <i>brut</i>\n\n@\n\n![Alt](a.png)\n\n```js\nlet a;\n```", "a.md", ENTRY);

        assert.equal(text, "Titre\nUn mot et code brut\nArobase\nAlt\nlet a;\nBloc\nFin");
    });
});

describe("MarkdownRenderer headings", () => {
    const BODY = "Intro *texte*\n\n## Premiers pas\n\nLe lien.\n\n### Détails\n\n## Premiers pas\n\nEncore.";

    it("adds unique ids to headings", async () => {
        const { html } = await new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [], []).render(BODY, "a.md", ENTRY);

        assert.match(html, /<h2 id="premiers-pas">Premiers pas<\/h2>/);
        assert.match(html, /<h3 id="details">Détails<\/h3>/);
        assert.match(html, /<h2 id="premiers-pas-1">/);
    });

    it("keeps ids set by plugins and can be disabled", async () => {
        const plugin = () => (tree: Root) => {
            visit(tree, "heading", (node) => {
                node.data = { hProperties: { id: "custom" } };
            });
        };
        const custom = await new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [plugin], []).render("## A", "a.md", ENTRY);
        const disabled = await new MarkdownRenderer({ gfm: true, html: false, headingIds: false }, [], []).render("## A", "a.md", ENTRY);

        assert.equal(custom.html, '<h2 id="custom">A</h2>');
        assert.equal(disabled.html, "<h2>A</h2>");
    });

    it("splits the text into sections at top-level headings", async () => {
        const { sections } = await new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [], []).render(BODY, "a.md", ENTRY);

        assert.deepEqual(sections, [
            { anchor: undefined, heading: undefined, text: "Intro texte" },
            { anchor: "premiers-pas", heading: "Premiers pas", text: "Le lien." },
            { anchor: "details", heading: "Détails", text: "" },
            { anchor: "premiers-pas-1", heading: "Premiers pas", text: "Encore." },
        ]);
    });
});

describe("OutputWriter", () => {
    it("maps URLs to files", () => {
        assert.equal(OutputWriter.fileForUrl("/"), "index.html");
        assert.equal(OutputWriter.fileForUrl("/tags/c%23/"), "tags/c#/index.html");
        assert.equal(OutputWriter.fileForUrl("/404.html"), "404.html");
        assert.throws(() => OutputWriter.fileForUrl("/../x/"), /Invalid output URL/);
    });
});
