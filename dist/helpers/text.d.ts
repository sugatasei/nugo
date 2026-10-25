export interface SlugifyOptions {
    readonly locale?: string;
}
export declare function slugify(value: string, options?: SlugifyOptions): string;
export declare function escapeXml(value: string): string;
export declare function safeJson(data: unknown): string;
export declare function absoluteUrl(siteUrl: string, path: string): string;
