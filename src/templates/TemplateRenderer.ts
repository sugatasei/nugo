import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import Handlebars from "handlebars";
import { FileSystem } from "../build/FileSystem.ts";
import { absoluteUrl, safeJson } from "../helpers/text.ts";
import type { Helper, Site } from "../types.ts";

type Context = Readonly<Record<string, unknown>>;

export class TemplateRenderer {
    private readonly handlebars = Handlebars.create();
    private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
    private readonly dir: string;

    constructor(dir: string, site: Site, helpers: ReadonlyMap<string, Helper>, partials: ReadonlyMap<string, string>) {
        this.dir = dir;

        // helpers techniques uniquement : toute présentation reste dans les gabarits du site
        this.handlebars.registerHelper("json", (data: unknown) => new Handlebars.SafeString(safeJson(data)));
        this.handlebars.registerHelper("absoluteUrl", (path: unknown) => typeof path === "string" ? absoluteUrl(site.url, path) : undefined);

        for (const [name, helper] of helpers) {
            this.handlebars.registerHelper(name, helper);
        }

        const partialsDir = join(dir, "partials");

        for (const filePath of FileSystem.getFiles(partialsDir).filter((path) => path.endsWith(".hbs"))) {
            const name = relative(partialsDir, filePath).split(sep).join("/").replace(/\.hbs$/, "");
            this.handlebars.registerPartial(name, readFileSync(filePath, "utf-8"));
        }

        for (const [name, source] of partials) {
            this.handlebars.registerPartial(name, source);
        }
    }

    render(name: string, context: Context = {}): string {
        return this.getTemplate(name)(context);
    }

    renderPage(template: string, layout: string | false, context: Context): string {
        const content = this.render(template, context);

        return layout ? this.render(layout, { ...context, content }) : content;
    }

    private getTemplate(name: string): Handlebars.TemplateDelegate {
        const cached = this.templates.get(name);

        if (cached) {
            return cached;
        }

        const filePath = join(this.dir, `${name}.hbs`);

        if (!existsSync(filePath)) {
            throw new Error(`Template "${name}" not found (${filePath})`);
        }

        const template = this.handlebars.compile(readFileSync(filePath, "utf-8"));
        this.templates.set(name, template);

        return template;
    }
}
