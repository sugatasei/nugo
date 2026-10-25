import { visit } from "unist-util-visit";
import { slugify } from "../helpers/text.js";
import { MarkdownText } from "./MarkdownText.js";
// ancre sur chaque titre (## Premiers pas → id="premiers-pas"), partagée par le HTML et la recherche
export const headingIds = (options = {}) => (tree) => {
    const used = new Set();
    visit(tree, "heading", (node) => {
        const existing = node.data?.hProperties?.id;
        if (existing !== undefined) {
            used.add(String(existing));
            return;
        }
        let base;
        try {
            base = slugify(MarkdownText.extract(node), options);
        }
        catch {
            return;
        }
        let id = base;
        for (let suffix = 1; used.has(id); suffix++) {
            id = `${base}-${suffix}`;
        }
        used.add(id);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    });
};
