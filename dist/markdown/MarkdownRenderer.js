import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";
import { headingIds } from "./HeadingIds.js";
import { MarkdownText } from "./MarkdownText.js";
// le HTML écrit par l'auteur est retiré ; les nœuds html produits par les plugins passent
const stripAuthorHtml = () => (tree) => {
    visit(tree, "html", (_node, index, parent) => {
        if (parent && index !== undefined) {
            parent.children.splice(index, 1);
            return [SKIP, index];
        }
        return undefined;
    });
};
export class MarkdownRenderer {
    processor;
    constructor(options, remarkPlugins, rehypePlugins) {
        const remark = [
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
            .freeze();
    }
    async render(body, path, entry) {
        const file = new VFile({ path, value: body, data: { entry } });
        // les plugins remark modifient l'arbre Markdown en place : on y lit le texte après leur passage
        const tree = this.processor.parse(file);
        const html = this.processor.stringify(await this.processor.run(tree, file), file);
        const { entry: _entry, ...meta } = file.data;
        return { html: String(html), text: MarkdownText.extract(tree), sections: MarkdownText.sections(tree), meta };
    }
}
