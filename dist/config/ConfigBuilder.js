import { z } from "zod";
const SiteSchema = z
    .object({
    url: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
})
    .loose();
export class ConfigBuilder {
    siteData;
    dirValues = { content: "content", public: "public", templates: "templates", output: "build" };
    defaultLayout = false;
    frontMatterDelimiters = ["---", "---"];
    collections = new Map();
    pageFactories = [];
    outputs = new Map();
    markdownOptions = { gfm: true, html: false, headingIds: true };
    remarkPlugins = [];
    rehypePlugins = [];
    helpers = new Map();
    partials = new Map();
    passthroughs = [];
    hooks = { beforeBuild: [], afterBuild: [] };
    site(site) {
        this.siteData = { ...this.siteData, ...site };
        return this;
    }
    dirs(dirs) {
        this.dirValues = { ...this.dirValues, ...dirs };
        return this;
    }
    layout(layout) {
        this.defaultLayout = layout;
        return this;
    }
    frontMatter(delimiters) {
        this.frontMatterDelimiters = delimiters;
        return this;
    }
    collection(name, options) {
        if (this.collections.has(name)) {
            throw new Error(`Collection "${name}" is already defined`);
        }
        this.collections.set(name, options);
        return this;
    }
    pages(factory) {
        this.pageFactories.push(factory);
        return this;
    }
    output(path, factory) {
        if (this.outputs.has(path)) {
            throw new Error(`Output "${path}" is already defined`);
        }
        this.outputs.set(path, factory);
        return this;
    }
    markdown(options) {
        this.markdownOptions = { ...this.markdownOptions, ...options };
        return this;
    }
    remark(plugin) {
        this.remarkPlugins.push(plugin);
        return this;
    }
    rehype(plugin) {
        this.rehypePlugins.push(plugin);
        return this;
    }
    helper(name, helper) {
        this.helpers.set(name, helper);
        return this;
    }
    partial(name, source) {
        this.partials.set(name, source);
        return this;
    }
    passthrough(from, to = from) {
        this.passthroughs.push({ from, to });
        return this;
    }
    on(hook, handler) {
        this.hooks[hook].push(handler);
        return this;
    }
    use(plugin) {
        plugin(this);
        return this;
    }
    resolve() {
        if (!this.siteData) {
            throw new Error("nugo.site({ url }) is required");
        }
        return {
            site: SiteSchema.parse(this.siteData),
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
