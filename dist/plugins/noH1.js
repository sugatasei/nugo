import { visit } from "unist-util-visit";
// pour les sites dont les gabarits affichent déjà le titre en <h1>
const rejectHeadingOne = () => (tree, file) => {
    visit(tree, "heading", (node) => {
        if (node.depth === 1) {
            const line = node.position ? `:${node.position.start.line}` : "";
            throw new Error(`${file.path}${line} contains a level-one heading`);
        }
    });
};
export function noH1() {
    return (nugo) => {
        nugo.remark(rejectHeadingOne);
    };
}
