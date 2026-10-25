import type { HelperDelegate, HelperOptions } from "handlebars";
import type { Pluggable } from "unified";
import type { z } from "zod";
export type EntryData = Record<string, any>;
export interface Site {
    readonly url: string;
    readonly [key: string]: unknown;
}
export interface Dirs {
    readonly content: string;
    readonly public: string;
    readonly templates: string;
    readonly output: string;
}
export interface EntrySource<D = EntryData> {
    readonly collection: string;
    readonly src: string;
    readonly slug: string;
    readonly data: D;
}
export interface EntrySection {
    readonly anchor?: string;
    readonly heading?: string;
    readonly text: string;
}
export interface Entry<D = EntryData> extends EntrySource<D> {
    readonly url: string;
    readonly html: string;
    readonly text: string;
    readonly sections: readonly EntrySection[];
    readonly meta: Readonly<Record<string, unknown>>;
    readonly updatedAt: string;
    readonly noindex: boolean;
}
export interface CollectionOptions<D extends EntryData = EntryData> {
    readonly dir: string;
    readonly schema?: z.ZodType<D>;
    readonly permalink?: (entry: EntrySource<D>) => string;
    readonly template?: string;
    readonly layout?: string | false;
    readonly sort?: (left: Entry<D>, right: Entry<D>) => number;
    readonly assetFields?: readonly string[];
    readonly noindex?: (entry: EntrySource<D>) => boolean;
}
export interface PageSpec {
    readonly url: string;
    readonly template: string;
    readonly layout?: string | false;
    readonly data?: Readonly<Record<string, unknown>>;
    readonly noindex?: boolean;
    readonly lastModified?: string;
}
export interface RenderedPage {
    readonly url: string;
    readonly file: string;
    readonly noindex: boolean;
    readonly lastModified?: string;
    readonly entry?: Entry;
}
export interface BuildContext {
    readonly root: string;
    readonly dirs: Dirs;
    readonly site: Site;
    readonly entries: readonly Entry[];
    readonly pages: readonly RenderedPage[];
    collection(name: string): readonly Entry[];
    render(template: string, context?: Readonly<Record<string, unknown>>): string;
    absoluteUrl(path: string): string;
    assetFile(url: string): string | undefined;
}
export interface MarkdownOptions {
    readonly gfm: boolean;
    readonly html: boolean;
    readonly headingIds: boolean;
}
export type Awaitable<T> = T | Promise<T>;
export type PagesFactory = (context: BuildContext) => Awaitable<readonly PageSpec[]>;
export type OutputFactory = (context: BuildContext) => Awaitable<string | Uint8Array>;
export type Hook = (context: BuildContext) => Awaitable<void>;
export type HookName = "beforeBuild" | "afterBuild";
export type Helper = HelperDelegate;
export type { HelperOptions };
export type NugoPlugin = (nugo: Nugo) => void;
export type ConfigSetup = (nugo: Nugo) => Awaitable<void>;
export interface Nugo {
    site(site: Site): this;
    dirs(dirs: Partial<Dirs>): this;
    layout(layout: string | false): this;
    frontMatter(delimiters: readonly [open: string, close: string]): this;
    collection<D extends EntryData>(name: string, options: CollectionOptions<D>): this;
    pages(factory: PagesFactory): this;
    output(path: string, factory: OutputFactory): this;
    markdown(options: Partial<MarkdownOptions>): this;
    remark(plugin: Pluggable): this;
    rehype(plugin: Pluggable): this;
    helper(name: string, helper: Helper): this;
    partial(name: string, source: string): this;
    passthrough(from: string, to?: string): this;
    on(hook: HookName, handler: Hook): this;
    use(plugin: NugoPlugin): this;
}
