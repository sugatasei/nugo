const BLOCKS = new Set(["paragraph", "heading", "blockquote", "list", "listItem", "table", "tableRow", "tableCell", "code", "break"]);
const PHRASING_PARENTS = new Set(["paragraph", "heading", "tableCell"]);
export class MarkdownText {
    // texte brut d'un nœud Markdown déjà transformé par les plugins ; le HTML brut est ignoré
    static extract(node) {
        const parts = [];
        // un nœud html hors d'un paragraphe (ex. une barre produite par un plugin) est un bloc à part entière
        const walk = (current, inPhrasing = false) => {
            if (current.data?.searchText !== undefined) {
                parts.push(current.data.searchText);
            }
            else if (current.type === "text" || current.type === "inlineCode" || current.type === "code") {
                parts.push(current.value);
            }
            else if (current.type === "image" || current.type === "imageReference") {
                parts.push(current.alt ?? "");
            }
            else if ("children" in current) {
                const phrasing = inPhrasing || PHRASING_PARENTS.has(current.type);
                current.children.forEach((child) => walk(child, phrasing));
            }
            if (BLOCKS.has(current.type) || (current.type === "html" && !inPhrasing)) {
                parts.push("\n");
            }
        };
        walk(node);
        return parts.join("").replace(/[ \t]*\n\s*/g, "\n").trim();
    }
    // découpe aux titres de premier niveau du document ; le texte avant le premier titre forme une section sans titre
    static sections(tree) {
        const sections = [{ parts: [] }];
        for (const node of tree.children) {
            if (node.type === "heading") {
                const id = node.data?.hProperties?.id;
                sections.push({
                    anchor: typeof id === "string" ? id : undefined,
                    heading: this.extract(node),
                    parts: [],
                });
            }
            else {
                sections.at(-1)?.parts.push(this.extract(node));
            }
        }
        return sections
            .map(({ anchor, heading, parts }) => ({ anchor, heading, text: parts.filter(Boolean).join("\n") }))
            .filter((section) => section.heading || section.text);
    }
}
