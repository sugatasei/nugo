import { visit } from "unist-util-visit";
// espace fine insécable avant ; ! ? », espace insécable avant : et après «
const RULES = [
    [/[ \t]+([;!?»])/g, " $1"],
    [/[ \t]+:/g, " :"],
    [/«[ \t]+/g, "« "],
];
// seuls les nœuds texte sont touchés : le code et le HTML restent intacts
export const remarkFrenchSpacing = () => (tree) => {
    visit(tree, "text", (node) => {
        for (const [pattern, replacement] of RULES) {
            node.value = node.value.replace(pattern, replacement);
        }
    });
};
export function frenchSpacing() {
    return (nugo) => {
        nugo.remark(remarkFrenchSpacing);
    };
}
