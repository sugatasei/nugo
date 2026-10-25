import type { Helper, Site } from "../types.ts";
type Context = Readonly<Record<string, unknown>>;
export declare class TemplateRenderer {
    private readonly handlebars;
    private readonly templates;
    private readonly dir;
    constructor(dir: string, site: Site, helpers: ReadonlyMap<string, Helper>, partials: ReadonlyMap<string, string>);
    render(name: string, context?: Context): string;
    renderPage(template: string, layout: string | false, context: Context): string;
    private getTemplate;
}
export {};
