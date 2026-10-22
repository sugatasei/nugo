import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupByDate, latestUpdate, paginate, taxonomy } from "../src/helpers/collections.ts";
import { absoluteUrl, safeJson, slugify } from "../src/helpers/text.ts";
import type { Entry } from "../src/types.ts";

const entry = (src: string, data: Record<string, unknown>, updatedAt = "2026-01-01T00:00:00.000Z"): Entry => ({
    collection: "posts", src, slug: src, data, url: `/${src}/`, html: "", text: "", sections: [], meta: {}, updatedAt, noindex: false,
});

describe("slugify", () => {
    it("transliterates and strips diacritics", () => {
        assert.equal(slugify("Nécromant de sang"), "necromant-de-sang");
        assert.equal(slugify("Straße Ökologie"), "strasse-oekologie");
        assert.equal(slugify("C++ & C#"), "c++-c#");
    });

    it("rejects values without a usable slug", () => {
        assert.throws(() => slugify("!!!"), /no usable slug/);
    });
});

describe("paginate", () => {
    it("splits items and links pages", () => {
        const pages = paginate([1, 2, 3, 4, 5], 2, (n) => n === 1 ? "/" : `/page/${n}/`);

        assert.equal(pages.length, 3);
        assert.deepEqual(pages[0], { number: 1, total: 3, items: [1, 2], url: "/", previous: undefined, next: "/page/2/" });
        assert.equal(pages[2]?.previous, "/page/2/");
        assert.equal(pages[2]?.next, undefined);
    });

    it("always returns at least one page", () => {
        assert.equal(paginate([], 10, () => "/").length, 1);
    });
});

describe("groupByDate", () => {
    it("groups by year, month and day in order", () => {
        const entries = [entry("c", { date: "2026-08-23" }), entry("b", { date: "2026-08-20" }), entry("a", { date: "2025-12-01" })];

        assert.deepEqual(groupByDate(entries, "year").map((group) => [group.key, group.items.length]), [["2026", 2], ["2025", 1]]);
        assert.deepEqual(groupByDate(entries, "month").map((group) => group.key), ["2026-08", "2025-12"]);
        assert.deepEqual(groupByDate(entries, "day").map((group) => group.key), ["2026-08-23", "2026-08-20", "2025-12-01"]);
    });

    it("fails on entries without date", () => {
        assert.throws(() => groupByDate([entry("x", {})], "year"), /no "date" date/);
    });
});

describe("taxonomy", () => {
    it("merges labels sharing a slug and sorts by label", () => {
        const terms = taxonomy([
            entry("a", { tags: ["Build", "groupe", "build"] }),
            entry("b", { tags: ["build", "Élite"] }),
        ], "tags", { locale: "fr-FR" });

        assert.deepEqual(terms.map((term) => [term.label, term.slug, term.items.length]), [
            ["Build", "build", 2],
            ["Élite", "elite", 1],
            ["groupe", "groupe", 1],
        ]);
    });
});

describe("latestUpdate", () => {
    it("returns the most recent update", () => {
        assert.equal(latestUpdate([entry("a", {}, "2026-01-01T00:00:00Z"), entry("b", {}, "2026-03-01T00:00:00Z")]), "2026-03-01T00:00:00Z");
        assert.equal(latestUpdate([]), undefined);
    });
});

describe("text helpers", () => {
    it("builds absolute URLs", () => {
        assert.equal(absoluteUrl("https://example.org/", "/a/"), "https://example.org/a/");
    });

    it("escapes script-breaking characters", () => {
        assert.equal(safeJson({ html: "</script>" }), '{"html":"\\u003c/script\\u003e"}');
    });
});
