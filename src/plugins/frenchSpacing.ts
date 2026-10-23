import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { NugoPlugin } from "../types.ts";

// espace fine insécable avant ; ! ? », espace insécable avant : et après «
const RULES: readonly (readonly [RegExp, string])[] = [
    [/[ \t]+([;!?»])/g, " $1"],
    [/[ \t]+:/g, " :"],
    [/«[ \t]+/g, "« "],
];

// seuls les nœuds texte sont touchés : le code et le HTML restent intacts
export const remarkFrenchSpacing = () => (tree: Root) => {
    visit(tree, "text", (node) => {
        for (const [pattern, replacement] of RULES) {
            node.value = node.value.replace(pattern, replacement);
        }
    });
};

export function frenchSpacing(): NugoPlugin {
    return (nugo) => {
        nugo.remark(remarkFrenchSpacing);
    };
}
