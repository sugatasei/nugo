import type { PluggableList } from "unified";
import type { FrontMatterDelimiters } from "../content/FrontMatter.ts";
import type { CollectionOptions, Dirs, EntryData, Helper, Hook, HookName, MarkdownOptions, OutputFactory, PagesFactory, Nugo, NugoPlugin, Site } from "../types.ts";
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
export declare class ConfigBuilder implements Nugo {
    private siteData?;
    private dirValues;
    private defaultLayout;
    private frontMatterDelimiters;
    private readonly collections;
    private readonly pageFactories;
    private readonly outputs;
    private markdownOptions;
    private readonly remarkPlugins;
    private readonly rehypePlugins;
    private readonly helpers;
    private readonly partials;
    private readonly passthroughs;
    private readonly hooks;
    site(site: Site): this;
    dirs(dirs: Partial<Dirs>): this;
    layout(layout: string | false): this;
    frontMatter(delimiters: FrontMatterDelimiters): this;
    collection<D extends EntryData>(name: string, options: CollectionOptions<D>): this;
    pages(factory: PagesFactory): this;
    output(path: string, factory: OutputFactory): this;
    markdown(options: Partial<MarkdownOptions>): this;
    remark(plugin: PluggableList[number]): this;
    rehype(plugin: PluggableList[number]): this;
    helper(name: string, helper: Helper): this;
    partial(name: string, source: string): this;
    passthrough(from: string, to?: string): this;
    on(hook: HookName, handler: Hook): this;
    use(plugin: NugoPlugin): this;
    resolve(): ResolvedConfig;
}
