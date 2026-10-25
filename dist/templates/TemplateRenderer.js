import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import Handlebars from "handlebars";
import { FileSystem } from "../build/FileSystem.js";
import { absoluteUrl, safeJson } from "../helpers/text.js";
export class TemplateRenderer {
    handlebars = Handlebars.create();
    templates = new Map();
    dir;
    constructor(dir, site, helpers, partials) {
        this.dir = dir;
        // helpers techniques uniquement : toute présentation reste dans les gabarits du site
        this.handlebars.registerHelper("json", (data) => new Handlebars.SafeString(safeJson(data)));
        this.handlebars.registerHelper("absoluteUrl", (path) => typeof path === "string" ? absoluteUrl(site.url, path) : undefined);
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
    render(name, context = {}) {
        return this.getTemplate(name)(context);
    }
    renderPage(template, layout, context) {
        const content = this.render(template, context);
        return layout ? this.render(layout, { ...context, content }) : content;
    }
    getTemplate(name) {
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
