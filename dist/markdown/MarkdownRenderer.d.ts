import { type PluggableList } from "unified";
import type { EntrySection, EntrySource, MarkdownOptions } from "../types.ts";
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
export declare class MarkdownRenderer {
    private readonly processor;
    constructor(options: MarkdownOptions, remarkPlugins: PluggableList, rehypePlugins: PluggableList);
    render(body: string, path: string, entry: MarkdownEntry): Promise<RenderedMarkdown>;
}
