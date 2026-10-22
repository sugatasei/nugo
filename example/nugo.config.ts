import { absoluteUrl, defineConfig, type HelperOptions, groupByDate, latestUpdate, paginate, safeJson, slugify, taxonomy, z, type Entry, type PageSpec } from "nugo";
import { noH1, robots, rss, search, securityTxt, sitemap } from "nugo/plugins";
import { countLabel, formatDate, formatMonth, LOCALE, monthArchiveTitle } from "./lib/format.ts";
import { callouts } from "./plugins/callouts.ts";

const PostSchema = z
    .object({
        title: z.string().min(1),
        date: z.iso.date(),
        summary: z.string().optional(),
        cover: z.string().optional(),
        tags: z.array(z.string().trim().min(1)).default([]),
        noindex: z.boolean().default(false),
    })
    .loose();

const PageSchema = z
    .object({
        title: z.string().min(1),
        path: z.string().regex(/^\/(?:[a-z0-9-]+\/)*$/).optional(),
        noindex: z.boolean().default(false),
    })
    .loose();

const SITE = {
    url: "https://example.org",
    title: "Exemple nugo",
    description: "Site de démonstration du moteur nugo",
    author: "Mathieu",
    lang: "fr",
};

// l'URL effective (http://localhost:<port> en mode dev) se lit dans le contexte de la page, pas dans SITE
const siteUrl = (options: HelperOptions): string => options.data.root.site.url;

const tagUrl = (label: string): string => `/tags/${encodeURIComponent(slugify(label, { locale: LOCALE }))}/`;
const monthUrl = (month: string): string => `/blog/${month.replace("-", "/")}/`;

export default defineConfig((nugo) => {
    nugo
        .site(SITE)
        .layout("layouts/base")
        .passthrough("node_modules/@picocss/pico/css/pico.min.css", "pico.min.css");

    nugo.collection("posts", {
        dir: "blog",
        schema: PostSchema,
        template: "pages/article",
        sort: (left, right) => right.data.date.localeCompare(left.data.date),
        assetFields: ["cover"],
    });

    nugo.collection("pages", {
        dir: "pages",
        schema: PageSchema,
        template: "pages/page",
        permalink: (entry) => entry.data.path ?? `/${entry.slug}/`,
    });

    // helpers de présentation : propres au site, pas au moteur
    nugo
        .helper("formatDate", (date: string) => formatDate(date))
        .helper("formatMonth", (date: string) => formatMonth(date))
        .helper("monthUrl", (date: string) => monthUrl(date.slice(0, 7)))
        .helper("tagUrl", (label: string) => tagUrl(label))
        .helper("count", (items: readonly unknown[]) => countLabel(items.length))
        .helper("postJsonLd", (entry: Entry, options: HelperOptions) => safeJson({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: entry.data.title,
            datePublished: entry.data.date,
            dateModified: entry.updatedAt,
            author: { "@type": "Person", name: SITE.author },
            mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(siteUrl(options), entry.url) },
            ...(entry.data.summary ? { description: entry.data.summary } : {}),
            ...(entry.data.cover ? { image: absoluteUrl(siteUrl(options), entry.data.cover) } : {}),
        }))
        .helper("websiteJsonLd", (options: HelperOptions) => safeJson({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE.title,
            description: SITE.description,
            url: absoluteUrl(siteUrl(options), "/"),
        }))
        .helper("or", (...values: unknown[]) => values.slice(0, -1).some(Boolean));

    nugo.pages((context) => {
        const posts = context.collection("posts");
        const months = groupByDate(posts, "month");
        const archive = (url: string, title: string, items: readonly Entry[], extra = {}): PageSpec => ({
            url,
            template: "pages/archive",
            data: { title, posts: items, ...extra },
            lastModified: latestUpdate(items),
        });

        return [
            ...paginate(posts, 10, (number) => number === 1 ? "/" : `/page/${number}/`).map((pagination) => ({
                url: pagination.url,
                template: "pages/index",
                data: { pagination, posts: pagination.items, home: pagination.number === 1 },
                lastModified: latestUpdate(pagination.items),
            })),
            ...groupByDate(posts, "year").map(({ key, items }) => archive(`/blog/${key}/`, `Articles de ${key}`, items)),
            ...months.map(({ key, items }, index) => archive(monthUrl(key), monthArchiveTitle(key), items, {
                older: months[index + 1] && { url: monthUrl(months[index + 1]!.key), label: formatMonth(months[index + 1]!.key) },
                newer: months[index - 1] && { url: monthUrl(months[index - 1]!.key), label: formatMonth(months[index - 1]!.key) },
            })),
            ...groupByDate(posts, "day").map(({ key, items }) => archive(`/blog/${key.replaceAll("-", "/")}/`, `Articles du ${formatDate(key)}`, items)),
            {
                url: "/archives/",
                template: "pages/archives",
                data: { title: "Archives", months: months.map(({ key, items }) => ({ url: monthUrl(key), label: formatMonth(key), items })) },
                lastModified: latestUpdate(posts),
            },
            ...taxonomy(posts, "tags", { locale: LOCALE }).map((term) => ({
                url: tagUrl(term.label),
                template: "pages/tag",
                data: { title: `Tag « ${term.label} »`, term, posts: term.items },
                lastModified: latestUpdate(term.items),
            })),
            {
                url: "/tags/",
                template: "pages/tag-index",
                data: { title: "Tags", terms: taxonomy(posts, "tags", { locale: LOCALE }) },
                lastModified: latestUpdate(posts),
            },
            { url: "/404.html", template: "pages/not-found", data: { title: "Page introuvable" }, noindex: true },
        ];
    });

    nugo
        .use(noH1())
        .use(callouts({ labels: { note: "Note", tip: "Astuce", warning: "Attention" } }))
        .use(rss({ collection: "posts", language: "fr" }))
        // tags en minuscules : « Nugo » et « nugo » forment un seul filtre, comme sur les pages de tags
        .use(search({ language: "fr", filters: (entry) => ({ tag: (entry.data.tags ?? []).map((tag: string) => tag.toLocaleLowerCase(LOCALE)) }) }))
        .use(sitemap())
        .use(robots())
        .use(securityTxt({ contact: "security@example.org", preferredLanguages: ["fr"] }));
});
