import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { ResolvedConfig } from "../config/ConfigBuilder.ts";
import { ContentScanner, type Collections } from "../content/ContentScanner.ts";
import { absoluteUrl } from "../helpers/text.ts";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer.ts";
import { TemplateRenderer } from "../templates/TemplateRenderer.ts";
import type { BuildContext, Dirs, Entry, PageSpec, RenderedPage, Site } from "../types.ts";
import { BuildLock } from "./BuildLock.ts";
import { FileSystem } from "./FileSystem.ts";
import { OutputWriter } from "./OutputWriter.ts";

export interface BuildResult {
    readonly pages: readonly RenderedPage[];
    readonly entries: readonly Entry[];
}

class Build implements BuildContext {
    readonly root: string;
    readonly dirs: Dirs;
    readonly site: Site;
    readonly pages: RenderedPage[] = [];
    entries: readonly Entry[] = [];
    private collections: Collections = new Map();
    private readonly templates: TemplateRenderer;

    constructor(root: string, dirs: Dirs, site: Site, templates: TemplateRenderer) {
        this.root = root;
        this.dirs = dirs;
        this.site = site;
        this.templates = templates;
    }

    setCollections(collections: Collections): void {
        this.collections = collections;
        this.entries = [...collections.values()].flat();
    }

    collectionsObject(): Readonly<Record<string, readonly Entry[]>> {
        return Object.fromEntries(this.collections);
    }

    collection(name: string): readonly Entry[] {
        const entries = this.collections.get(name);

        if (!entries) {
            throw new Error(`Unknown collection "${name}"`);
        }

        return entries;
    }

    render(template: string, context: Readonly<Record<string, unknown>> = {}): string {
        return this.templates.render(template, { site: this.site, ...context });
    }

    absoluteUrl(path: string): string {
        return absoluteUrl(this.site.url, path);
    }
}

export class Builder {
    static async run(root: string, config: ResolvedConfig): Promise<BuildResult> {
        return BuildLock.with(resolve(root), () => this.build(root, config));
    }

    private static async build(root: string, config: ResolvedConfig): Promise<BuildResult> {
        const dirs: Dirs = {
            content: resolve(root, config.dirs.content),
            public: resolve(root, config.dirs.public),
            templates: resolve(root, config.dirs.templates),
            output: resolve(root, config.dirs.output),
        };

        // le dossier de sortie est vidé à chaque build : il ne doit jamais contenir la racine du site
        if (!relative(dirs.output, resolve(root)).startsWith("..")) {
            throw new Error(`The output directory ${dirs.output} cannot contain the site root`);
        }

        FileSystem.removeDirectory(dirs.output);
        FileSystem.createDirectory(dirs.output);

        if (existsSync(dirs.public)) {
            FileSystem.copy(dirs.public, dirs.output);
        }

        for (const { from, to } of config.passthroughs) {
            FileSystem.copy(resolve(root, from), join(dirs.output, OutputWriter.fileForUrl(`/${to}`)));
        }

        const templates = new TemplateRenderer(dirs.templates, config.site, config.helpers, config.partials);
        const build = new Build(root, dirs, config.site, templates);
        const writer = new OutputWriter(dirs.output);

        for (const hook of config.hooks.beforeBuild) {
            await hook(build);
        }

        const markdown = new MarkdownRenderer(config.markdown, config.remarkPlugins, config.rehypePlugins);
        build.setCollections(await ContentScanner.scan(config.collections, dirs, markdown, config.frontMatter));

        const renderPage = (spec: PageSpec, entry?: Entry): void => {
            const file = OutputWriter.fileForUrl(spec.url);
            const context = {
                site: build.site,
                collections: build.collectionsObject(),
                page: { url: spec.url, noindex: spec.noindex ?? false },
                ...spec.data,
            };

            writer.write(file, templates.renderPage(spec.template, spec.layout ?? config.layout, context));
            build.pages.push({
                url: spec.url,
                file,
                noindex: spec.noindex ?? false,
                lastModified: spec.lastModified,
                entry,
            });
        };

        for (const [name, options] of config.collections) {
            if (!options.template) {
                continue;
            }

            for (const entry of build.collection(name)) {
                renderPage({
                    url: entry.url,
                    template: options.template,
                    layout: options.layout,
                    data: { ...entry.data, entry },
                    noindex: entry.noindex,
                    lastModified: entry.updatedAt,
                }, entry);
            }
        }

        for (const factory of config.pages) {
            for (const spec of await factory(build)) {
                renderPage(spec);
            }
        }

        for (const [path, factory] of config.outputs) {
            writer.write(OutputWriter.fileForUrl(`/${path.replace(/^\/+/, "")}`), await factory(build));
        }

        this.copyColocatedAssets(build.pages, dirs.content, writer);

        for (const hook of config.hooks.afterBuild) {
            await hook(build);
        }

        return { pages: build.pages, entries: build.entries };
    }

    // copie les fichiers voisins d'un index.md dans le dossier de sa page, sans descendre dans un autre index.md
    private static copyColocatedAssets(pages: readonly RenderedPage[], contentDir: string, writer: OutputWriter): void {
        const bundles = pages.filter(({ entry, file }) => entry
            && (entry.src === "index.md" || entry.src.endsWith("/index.md"))
            && file.endsWith("index.html"));
        const bundleDirs = new Set(bundles.map(({ entry }) => dirname(join(contentDir, entry?.src ?? ""))));

        for (const { entry, file } of bundles) {
            const sourceDir = dirname(join(contentDir, entry?.src ?? ""));

            for (const sourcePath of FileSystem.getFiles(sourceDir)) {
                if (!sourcePath.endsWith(".md") && !this.belongsToNestedBundle(sourcePath, sourceDir, bundleDirs)) {
                    writer.copy(sourcePath, join(dirname(file), relative(sourceDir, sourcePath)));
                }
            }
        }
    }

    private static belongsToNestedBundle(filePath: string, sourceDir: string, bundleDirs: ReadonlySet<string>): boolean {
        for (let dir = dirname(filePath); dir !== sourceDir && dir.startsWith(sourceDir); dir = dirname(dir)) {
            if (bundleDirs.has(dir)) {
                return true;
            }
        }

        return false;
    }
}
