import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remarkCallouts } from "../example/plugins/callouts.ts";
import { MarkdownRenderer } from "../src/markdown/MarkdownRenderer.ts";

const renderer = new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [[remarkCallouts, { labels: { note: "Note" } }]], []);
const ENTRY = { collection: "posts", src: "a.md", slug: "a", data: {}, url: "/a/" };

describe("example callouts plugin", () => {
    it("turns marked blockquotes into callouts", async () => {
        const { html } = await renderer.render("> [!NOTE]\n> Hello *world*", "a.md", ENTRY);

        assert.equal(html, '<article class="callout callout-note">\n<header>Note</header>\n<p>Hello <em>world</em></p>\n</article>');
    });

    it("leaves plain and unknown blockquotes untouched", async () => {
        assert.equal((await renderer.render("> Quote", "a.md", ENTRY)).html, "<blockquote>\n<p>Quote</p>\n</blockquote>");
        assert.equal((await renderer.render("> [!OTHER]\n> x", "a.md", ENTRY)).html, "<blockquote>\n<p>[!OTHER]\nx</p>\n</blockquote>");
    });
});
