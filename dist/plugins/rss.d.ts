import type { Entry, NugoPlugin } from "../types.ts";
export interface RssOptions {
    readonly collection: string;
    readonly path?: string;
    readonly title?: string;
    readonly description?: string;
    readonly language?: string;
    readonly limit?: number;
    readonly date?: (entry: Entry) => string | Date | undefined;
    readonly itemTitle?: (entry: Entry) => string;
    readonly itemDescription?: (entry: Entry) => string | undefined;
}
export declare function rss(options: RssOptions): NugoPlugin;
