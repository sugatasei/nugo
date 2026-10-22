import type { PluggableList } from "unified";
import type { FrontMatterDelimiters } from "../content/FrontMatter.ts";
import { z } from "zod";
import type {
    CollectionOptions,
    Dirs,
    EntryData,
    Helper,
    Hook,
    HookName,
    MarkdownOptions,
    OutputFactory,
    PagesFactory,
    Nugo,
    NugoPlugin,
    Site,
} from "../types.ts";

const SiteSchema = z
    .object({
        url: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    })
    .loose();

export interface Passthrough {
    readonly from: string;
    readonly to: string;
}

export interface ResolvedConfig {
    readonly site: Site;
    readonly dirs: Dirs;
    readonly layout: string | false;
    readonly frontMatter: FrontMatterDelimiters;
    readonly collections: ReadonlyMap<string, CollectionOptions>;
    readonly pages: readonly PagesFactory[];
    readonly outputs: ReadonlyMap<string, OutputFactory>;
    readonly markdown: MarkdownOptions;
    readonly remarkPlugins: PluggableList;
    readonly rehypePlugins: PluggableList;
    readonly helpers: ReadonlyMap<string, Helper>;
    readonly partials: ReadonlyMap<string, string>;
    readonly passthroughs: readonly Passthrough[];
    readonly hooks: Readonly<Record<HookName, readonly Hook[]>>;
}

export class ConfigBuilder implements Nugo {
    private siteData?: Site;
    private dirValues: Dirs = { content: "content", public: "public", templates: "templates", output: "build" };
    private defaultLayout: string | false = false;
    private frontMatterDelimiters: FrontMatterDelimiters = ["---", "---"];
    private readonly collections = new Map<string, CollectionOptions>();
    private readonly pageFactories: PagesFactory[] = [];
    private readonly outputs = new Map<string, OutputFactory>();
    private markdownOptions: MarkdownOptions = { gfm: true, html: false, headingIds: true };
    private readonly remarkPlugins: PluggableList = [];
    private readonly rehypePlugins: PluggableList = [];
    private readonly helpers = new Map<string, Helper>();
    private readonly partials = new Map<string, string>();
    private readonly passthroughs: Passthrough[] = [];
    private readonly hooks: Record<HookName, Hook[]> = { beforeBuild: [], afterBuild: [] };

    site(site: Site): this {
        this.siteData = { ...this.siteData, ...site };
        return this;
    }

    dirs(dirs: Partial<Dirs>): this {
        this.dirValues = { ...this.dirValues, ...dirs };
        return this;
    }

    layout(layout: string | false): this {
        this.defaultLayout = layout;
        return this;
    }

    frontMatter(delimiters: FrontMatterDelimiters): this {
        this.frontMatterDelimiters = delimiters;
        return this;
    }

    collection<D extends EntryData>(name: string, options: CollectionOptions<D>): this {
        if (this.collections.has(name)) {
            throw new Error(`Collection "${name}" is already defined`);
        }

        this.collections.set(name, options as unknown as CollectionOptions);
        return this;
    }

    pages(factory: PagesFactory): this {
        this.pageFactories.push(factory);
        return this;
    }

    output(path: string, factory: OutputFactory): this {
        if (this.outputs.has(path)) {
            throw new Error(`Output "${path}" is already defined`);
        }

        this.outputs.set(path, factory);
        return this;
    }

    markdown(options: Partial<MarkdownOptions>): this {
        this.markdownOptions = { ...this.markdownOptions, ...options };
        return this;
    }

    remark(plugin: PluggableList[number]): this {
        this.remarkPlugins.push(plugin);
        return this;
    }

    rehype(plugin: PluggableList[number]): this {
        this.rehypePlugins.push(plugin);
        return this;
    }

    helper(name: string, helper: Helper): this {
        this.helpers.set(name, helper);
        return this;
    }

    partial(name: string, source: string): this {
        this.partials.set(name, source);
        return this;
    }

    passthrough(from: string, to = from): this {
        this.passthroughs.push({ from, to });
        return this;
    }

    on(hook: HookName, handler: Hook): this {
        this.hooks[hook].push(handler);
        return this;
    }

    use(plugin: NugoPlugin): this {
        plugin(this);
        return this;
    }

    resolve(): ResolvedConfig {
        if (!this.siteData) {
            throw new Error("nugo.site({ url }) is required");
        }

        return {
            site: SiteSchema.parse(this.siteData) as Site,
            dirs: this.dirValues,
            layout: this.defaultLayout,
            frontMatter: this.frontMatterDelimiters,
            collections: this.collections,
            pages: this.pageFactories,
            outputs: this.outputs,
            markdown: this.markdownOptions,
            remarkPlugins: this.remarkPlugins,
            rehypePlugins: this.rehypePlugins,
            helpers: this.helpers,
            partials: this.partials,
            passthroughs: this.passthroughs,
            hooks: this.hooks,
        };
    }
}
