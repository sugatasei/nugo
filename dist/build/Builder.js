import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ContentScanner } from "../content/ContentScanner.js";
import { absoluteUrl } from "../helpers/text.js";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer.js";
import { TemplateRenderer } from "../templates/TemplateRenderer.js";
import { BuildLock } from "./BuildLock.js";
import { FileSystem } from "./FileSystem.js";
import { OutputWriter } from "./OutputWriter.js";
class Build {
    root;
    dirs;
    site;
    pages = [];
    entries = [];
    collections = new Map();
    assets = new Map();
    templates;
    constructor(root, dirs, site, templates) {
        this.root = root;
        this.dirs = dirs;
        this.site = site;
        this.templates = templates;
    }
    setScan({ collections, assets }) {
        this.collections = collections;
        this.assets = assets;
        this.entries = [...collections.values()].flat();
    }
    collectionsObject() {
        return Object.fromEntries(this.collections);
    }
    collection(name) {
        const entries = this.collections.get(name);
        if (!entries) {
            throw new Error(`Unknown collection "${name}"`);
        }
        return entries;
    }
    render(template, context = {}) {
        return this.templates.render(template, { site: this.site, ...context });
    }
    absoluteUrl(path) {
        return absoluteUrl(this.site.url, path);
    }
    assetFile(url) {
        const known = this.assets.get(url);
        if (known || !url.startsWith("/") || url.startsWith("//")) {
            return known;
        }
        try {
            const file = join(this.dirs.public, OutputWriter.fileForUrl(url));
            return url.endsWith("/") || !existsSync(file) || !statSync(file).isFile() ? undefined : file;
        }
        catch {
            return undefined;
        }
    }
}
export class Builder {
    static async run(root, config) {
        return BuildLock.with(resolve(root), () => this.build(root, config));
    }
    static async build(root, config) {
        const dirs = {
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
        build.setScan(await ContentScanner.scan(config.collections, dirs, markdown, config.frontMatter));
        const renderPage = (spec, entry) => {
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
    static copyColocatedAssets(pages, contentDir, writer) {
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
    static belongsToNestedBundle(filePath, sourceDir, bundleDirs) {
        for (let dir = dirname(filePath); dir !== sourceDir && dir.startsWith(sourceDir); dir = dirname(dir)) {
            if (bundleDirs.has(dir)) {
                return true;
            }
        }
        return false;
    }
}
