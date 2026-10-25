import type { NugoPlugin } from "../types.ts";
export interface SitemapOptions {
    readonly path?: string;
}
export declare function sitemap(options?: SitemapOptions): NugoPlugin;
