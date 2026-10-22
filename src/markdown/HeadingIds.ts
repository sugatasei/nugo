import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { slugify } from "../helpers/text.ts";
import { MarkdownText } from "./MarkdownText.ts";

// ancre sur chaque titre (## Premiers pas → id="premiers-pas"), partagée par le HTML et la recherche
export const headingIds = (options: { readonly locale?: string } = {}) => (tree: Root): void => {
    const used = new Set<string>();

    visit(tree, "heading", (node) => {
        const existing = node.data?.hProperties?.id;

        if (existing !== undefined) {
            used.add(String(existing));
            return;
        }

        let base: string;

        try {
            base = slugify(MarkdownText.extract(node), options);
        } catch {
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
