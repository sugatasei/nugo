import { join } from "node:path";
import * as pagefind from "pagefind";
import type { Entry, EntrySection, NugoPlugin } from "../types.ts";

export interface SearchOptions {
    // code ISO 639-1, ex. "fr" : choisit le découpage des mots et la racinisation
    readonly language: string;
    readonly collections?: readonly string[];
    readonly path?: string;
    // un résultat par section (lien vers l'ancre du titre) ; false : un résultat par entrée
    readonly sections?: boolean;
    readonly meta?: (entry: Entry, section?: EntrySection) => Readonly<Record<string, string | undefined>>;
    readonly filters?: (entry: Entry) => Readonly<Record<string, readonly string[] | undefined>>;
    readonly sort?: (entry: Entry) => Readonly<Record<string, string | undefined>>;
}

const defined = <T>(record: Readonly<Record<string, T | undefined>>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter((pair): pair is [string, T] => pair[1] !== undefined));

const titleOf = (entry: Entry): string => typeof entry.data.title === "string" ? entry.data.title : entry.slug;

/**
 * Index Pagefind construit depuis les entrées (front matter + texte Markdown), sans relire le HTML.
 * Par défaut, chaque section (texte entre deux titres) est un résultat qui pointe sur l'ancre de son titre,
 * titré « Titre de l'entrée › Titre de la section ».
 * Écrit l'index et l'interface Pagefind (pagefind-ui.js / .css) dans <output>/<path>.
 */
export function search(options: SearchOptions): NugoPlugin {
    const meta = options.meta ?? ((entry: Entry, section?: EntrySection) => ({
        title: section?.heading ? `${titleOf(entry)} › ${section.heading}` : titleOf(entry),
    }));
    const filters: NonNullable<SearchOptions["filters"]> = options.filters ?? (() => ({}));
    const sort = options.sort ?? ((entry: Entry) => ({ date: typeof entry.data.date === "string" ? entry.data.date : undefined }));

    return (nugo) => {
        nugo.on("afterBuild", async (context) => {
            const entries = context.pages
                .flatMap((page) => page.entry && !page.noindex ? [page.entry] : [])
                .filter((entry) => !options.collections || options.collections.includes(entry.collection));
            const { index, errors } = await pagefind.createIndex({});

            try {
                if (!index) {
                    throw new Error(`Pagefind: ${errors.join("\n")}`);
                }

                for (const entry of entries) {
                    const entryFilters = Object.fromEntries(Object.entries(defined(filters(entry))).map(([name, values]) => [name, [...values]]));
                    const entrySort = defined(sort(entry));
                    const records = options.sections === false || !entry.sections.length
                        ? [{ url: entry.url, content: entry.text, meta: meta(entry) }]
                        : entry.sections.map((section) => ({
                            url: section.anchor ? `${entry.url}#${section.anchor}` : entry.url,
                            content: [section.heading, section.text].filter(Boolean).join("\n"),
                            meta: meta(entry, section),
                        }));

                    for (const record of records) {
                        const result = await index.addCustomRecord({
                            ...record,
                            language: options.language,
                            meta: defined(record.meta),
                            filters: entryFilters,
                            sort: entrySort,
                        });

                        if (result.errors.length) {
                            throw new Error(`Pagefind (${entry.src}): ${result.errors.join("\n")}`);
                        }
                    }
                }

                const written = await index.writeFiles({ outputPath: join(context.dirs.output, options.path ?? "pagefind") });

                if (written.errors.length) {
                    throw new Error(`Pagefind: ${written.errors.join("\n")}`);
                }
            } finally {
                await pagefind.close();
            }
        });
    };
}
