import type { Blockquote, Paragraph, Root } from "mdast";
import type { NugoPlugin } from "nugo";
import { visit } from "unist-util-visit";

export interface CalloutsOptions {
    // type → libellé affiché, ex. { note: "Note", warning: "Attention" }
    readonly labels: Readonly<Record<string, string>>;
}

const MARKER = /^\[!(\w+)\][ \t]*(?:\r?\n|$)/;

/**
 * > [!NOTE]
 * > Texte de l'encadré
 *
 * devient <article class="callout callout-note"><header>Note</header><p>Texte de l'encadré</p></article>
 */
function remarkCallouts(options: CalloutsOptions) {
    return (tree: Root): void => {
        visit(tree, "blockquote", (node: Blockquote) => {
            const paragraph = node.children[0];

            if (paragraph?.type !== "paragraph") {
                return;
            }

            const text = paragraph.children[0];
            const match = text?.type === "text" ? text.value.match(MARKER) : null;
            const type = match?.[1]?.toLowerCase();
            const label = type ? options.labels[type] : undefined;

            if (text?.type !== "text" || !match || !type || !label) {
                return;
            }

            text.value = text.value.slice(match[0].length);

            if (!text.value && paragraph.children.length === 1) {
                node.children.shift();
            }

            const header: Paragraph = { type: "paragraph", children: [{ type: "text", value: label }], data: { hName: "header" } };
            node.children.unshift(header);
            node.data = { hName: "article", hProperties: { className: ["callout", `callout-${type}`] } };
        });
    };
}

export function callouts(options: CalloutsOptions): NugoPlugin {
    return (nugo) => {
        nugo.remark([remarkCallouts, options]);
    };
}

export { remarkCallouts };
