/// <reference types="mdast-util-to-hast" preserve="true" />
import type { Nodes, Root } from "mdast";
import type { EntrySection } from "../types.ts";
declare module "mdast" {
    interface Data {
        searchText?: string;
    }
}
export declare class MarkdownText {
    static extract(node: Nodes): string;
    static sections(tree: Root): EntrySection[];
}
