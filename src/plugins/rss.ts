import { escapeXml } from "../helpers/text.ts";
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

export function rss(options: RssOptions): NugoPlugin {
    const getDate = options.date ?? ((entry: Entry) => entry.data.date as string | Date | undefined);
    const getTitle = options.itemTitle ?? ((entry: Entry) => String(entry.data.title ?? entry.slug));
    const getDescription = options.itemDescription ?? ((entry: Entry) => entry.data.summary as string | undefined);

    const toDate = (entry: Entry): Date => {
        const value = getDate(entry);

        if (!value) {
            throw new Error(`${entry.src} has no date`);
        }

        return value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    };

    return (nugo) => {
        nugo.output(options.path ?? "feed.xml", (context) => {
            const siteUrl = context.site.url.replace(/\/+$/, "");
            const items = context.collection(options.collection)
                .filter((entry) => !entry.noindex)
                .map((entry) => ({ entry, date: toDate(entry) }))
                .sort((left, right) => right.date.getTime() - left.date.getTime())
                .slice(0, options.limit ?? 50)
                .map(({ entry, date }) => {
                    const url = context.absoluteUrl(entry.url);
                    const description = getDescription(entry);

                    return [
                        "    <item>",
                        `      <title>${escapeXml(getTitle(entry))}</title>`,
                        `      <link>${escapeXml(url)}</link>`,
                        `      <guid>${escapeXml(url)}</guid>`,
                        `      <pubDate>${date.toUTCString()}</pubDate>`,
                        ...(description ? [`      <description>${escapeXml(description)}</description>`] : []),
                        "    </item>",
                    ].join("\n");
                });

            return [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<rss version="2.0">',
                "  <channel>",
                `    <title>${escapeXml(options.title ?? String(context.site.title ?? ""))}</title>`,
                `    <link>${escapeXml(siteUrl)}/</link>`,
                `    <description>${escapeXml(options.description ?? String(context.site.description ?? ""))}</description>`,
                ...(options.language ? [`    <language>${escapeXml(options.language)}</language>`] : []),
                `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
                ...items,
                "  </channel>",
                "</rss>",
                "",
            ].join("\n");
        });
    };
}
