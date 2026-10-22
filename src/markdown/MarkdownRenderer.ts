import type { Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified, type PluggableList, type Processor } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";
import type { EntrySection, EntrySource, MarkdownOptions } from "../types.ts";
import { headingIds } from "./HeadingIds.ts";
import { MarkdownText } from "./MarkdownText.ts";

export interface MarkdownEntry extends EntrySource {
    readonly url: string;
}

declare module "vfile" {
    interface DataMap {
        entry: MarkdownEntry;
    }
}

export interface RenderedMarkdown {
    readonly html: string;
    readonly text: string;
    readonly sections: readonly EntrySection[];
    readonly meta: Readonly<Record<string, unknown>>;
}

// le HTML écrit par l'auteur est retiré ; les nœuds html produits par les plugins passent
const stripAuthorHtml = () => (tree: Root) => {
    visit(tree, "html", (_node, index, parent) => {
        if (parent && index !== undefined) {
            parent.children.splice(index, 1);
            return [SKIP, index];
        }

        return undefined;
    });
};

export class MarkdownRenderer {
    private readonly processor: Processor;

    constructor(options: MarkdownOptions, remarkPlugins: PluggableList, rehypePlugins: PluggableList) {
        const remark: PluggableList = [
            ...(options.gfm ? [remarkGfm] : []),
            ...(options.html ? [] : [stripAuthorHtml]),
            ...remarkPlugins,
            // après les plugins du site, pour couvrir les titres qu'ils ajoutent
            ...(options.headingIds ? [headingIds] : []),
        ];

        this.processor = unified()
            .use(remarkParse)
            .use(remark)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypePlugins)
            .use(rehypeStringify, { allowDangerousHtml: true })
            .freeze() as unknown as Processor;
    }

    async render(body: string, path: string, entry: MarkdownEntry): Promise<RenderedMarkdown> {
        const file = new VFile({ path, value: body, data: { entry } });
        // les plugins remark modifient l'arbre Markdown en place : on y lit le texte après leur passage
        const tree = this.processor.parse(file) as Root;
        const html = this.processor.stringify(await this.processor.run(tree, file), file);
        const { entry: _entry, ...meta } = file.data;

        return { html: String(html), text: MarkdownText.extract(tree), sections: MarkdownText.sections(tree), meta };
    }
}
