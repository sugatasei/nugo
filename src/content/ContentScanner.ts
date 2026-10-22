import { readFileSync, statSync } from "node:fs";
import { relative, sep } from "node:path";
import { z } from "zod";
import { FileSystem } from "../build/FileSystem.ts";
import type { MarkdownRenderer } from "../markdown/MarkdownRenderer.ts";
import type { CollectionOptions, Dirs, Entry, EntrySource } from "../types.ts";
import { AssetResolver } from "./AssetResolver.ts";
import { FrontMatter, type FrontMatterDelimiters } from "./FrontMatter.ts";

export type Collections = ReadonlyMap<string, readonly Entry[]>;

export class ContentScanner {
    static async scan(
        collections: ReadonlyMap<string, CollectionOptions>,
        dirs: Dirs,
        markdown: MarkdownRenderer,
        delimiters?: FrontMatterDelimiters,
    ): Promise<Collections> {
        const grouped = new Map<string, Entry[]>([...collections.keys()].map((name) => [name, []]));

        for (const filePath of FileSystem.getFiles(dirs.content).filter((path) => path.endsWith(".md")).sort()) {
            const src = relative(dirs.content, filePath).split(sep).join("/");
            const [name, options] = this.findCollection(collections, src);
            const entry = await this.readEntry(filePath, src, name, options, dirs, markdown, delimiters);

            grouped.get(name)?.push(entry);
        }

        for (const [name, entries] of grouped) {
            const sort = collections.get(name)?.sort;

            if (sort) {
                entries.sort(sort);
            }
        }

        return grouped;
    }

    static normalizeDir(dir: string): string {
        return dir.replace(/^\.?\/+|\/+$/g, "").replace(/^\.$/, "");
    }

    private static findCollection(
        collections: ReadonlyMap<string, CollectionOptions>,
        src: string,
    ): [string, CollectionOptions] {
        let found: [string, CollectionOptions] | undefined;
        let foundLength = -1;

        for (const [name, options] of collections) {
            const dir = this.normalizeDir(options.dir);

            if ((dir === "" || src.startsWith(`${dir}/`)) && dir.length > foundLength) {
                found = [name, options];
                foundLength = dir.length;
            }
        }

        if (!found) {
            throw new Error(`${src} does not belong to any collection`);
        }

        return found;
    }

    private static async readEntry(
        filePath: string,
        src: string,
        collection: string,
        options: CollectionOptions,
        dirs: Dirs,
        markdown: MarkdownRenderer,
        delimiters?: FrontMatterDelimiters,
    ): Promise<Entry> {
        const { data: rawData, body } = FrontMatter.parse(readFileSync(filePath, "utf-8"), filePath, delimiters);
        const data = this.validate(rawData, options, filePath);
        const dir = this.normalizeDir(options.dir);
        const slug = (dir ? src.slice(dir.length + 1) : src).replace(/(^|\/)index\.md$|\.md$/, "");
        const source: EntrySource = { collection, src, slug, data };
        const url = options.permalink
            ? options.permalink(source)
            : `/${[dir, slug].filter(Boolean).join("/")}/`.replace(/^\/\/$/, "/");

        if (!url.startsWith("/")) {
            throw new Error(`${src} permalink must start with "/" (got "${url}")`);
        }

        const colocated = src === "index.md" || src.endsWith("/index.md");

        for (const field of options.assetFields ?? []) {
            data[field] = AssetResolver.resolve(data[field], {
                sourceFile: filePath,
                entryUrl: url,
                colocated,
                publicDir: dirs.public,
            });
        }

        const { html, text, sections, meta } = await markdown.render(body, filePath, { ...source, url });

        return {
            ...source,
            url,
            html,
            text,
            sections,
            meta,
            updatedAt: statSync(filePath).mtime.toISOString(),
            noindex: options.noindex ? options.noindex(source) : data.noindex === true,
        };
    }

    private static validate(data: Record<string, unknown>, options: CollectionOptions, filePath: string): Record<string, unknown> {
        if (!options.schema) {
            return { ...data };
        }

        const result = options.schema.safeParse(data);

        if (!result.success) {
            throw new Error(`${filePath} has an invalid front matter\n${z.prettifyError(result.error)}`);
        }

        return { ...result.data };
    }
}
