import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MarkdownRenderer } from "../src/markdown/MarkdownRenderer.ts";
import { remarkFrenchSpacing } from "../src/plugins/frenchSpacing.ts";

const renderer = new MarkdownRenderer({ gfm: true, html: false, headingIds: true }, [remarkFrenchSpacing], []);
const ENTRY = { collection: "posts", src: "a.md", slug: "a", data: {}, url: "/a/" };

describe("frenchSpacing plugin", () => {
    it("makes spaces before high punctuation non-breaking", async () => {
        const { html } = await renderer.render("Salü ! Pourquoi ? Voilà ; **Du jeu** : oui. « Hopla »", "a.md", ENTRY);

        assert.equal(html, "<p>Salü ! Pourquoi ? Voilà ; <strong>Du jeu</strong> : oui. « Hopla »</p>");
    });

    it("leaves code, URLs and heading ids untouched", async () => {
        const { html } = await renderer.render("## Pourquoi ?\n\n`a ? b` https://example.com", "a.md", ENTRY);

        assert.equal(html, '<h2 id="pourquoi">Pourquoi ?</h2>\n<p><code>a ? b</code> <a href="https://example.com">https://example.com</a></p>');
    });
});
