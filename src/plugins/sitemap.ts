import { escapeXml } from "../helpers/text.ts";
import type { NugoPlugin } from "../types.ts";

export interface SitemapOptions {
    readonly path?: string;
}

export function sitemap(options: SitemapOptions = {}): NugoPlugin {
    return (nugo) => {
        nugo.output(options.path ?? "sitemap.xml", (context) => {
            const urls = context.pages
                .filter((page) => !page.noindex)
                .toSorted((left, right) => left.url.localeCompare(right.url))
                .map((page) => [
                    "  <url>",
                    `    <loc>${escapeXml(context.absoluteUrl(page.url))}</loc>`,
                    ...(page.lastModified ? [`    <lastmod>${escapeXml(page.lastModified)}</lastmod>`] : []),
                    "  </url>",
                ].join("\n"));

            return [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                ...urls,
                "</urlset>",
                "",
            ].join("\n");
        });
    };
}
