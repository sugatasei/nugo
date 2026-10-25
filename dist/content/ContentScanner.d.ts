import type { MarkdownRenderer } from "../markdown/MarkdownRenderer.ts";
import type { CollectionOptions, Dirs, Entry } from "../types.ts";
import { type FrontMatterDelimiters } from "./FrontMatter.ts";
export type Collections = ReadonlyMap<string, readonly Entry[]>;
export interface ScanResult {
    readonly collections: Collections;
    readonly assets: ReadonlyMap<string, string>;
}
export declare class ContentScanner {
    static scan(collections: ReadonlyMap<string, CollectionOptions>, dirs: Dirs, markdown: MarkdownRenderer, delimiters?: FrontMatterDelimiters): Promise<ScanResult>;
    static normalizeDir(dir: string): string;
    private static findCollection;
    private static readEntry;
    private static validate;
}
