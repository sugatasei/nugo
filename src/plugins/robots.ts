import type { NugoPlugin } from "../types.ts";

export interface RobotsOptions {
    readonly rules?: readonly string[];
    readonly sitemap?: string | false;
}

export function robots(options: RobotsOptions = {}): NugoPlugin {
    return (nugo) => {
        nugo.output("robots.txt", (context) => [
            ...(options.rules ?? ["User-agent: *", "Allow: /"]),
            ...(options.sitemap === false ? [] : [`Sitemap: ${context.absoluteUrl(options.sitemap ?? "/sitemap.xml")}`]),
            "",
        ].join("\n"));
    };
}
