export function robots(options = {}) {
    return (nugo) => {
        nugo.output("robots.txt", (context) => [
            ...(options.rules ?? ["User-agent: *", "Allow: /"]),
            ...(options.sitemap === false ? [] : [`Sitemap: ${context.absoluteUrl(options.sitemap ?? "/sitemap.xml")}`]),
            "",
        ].join("\n"));
    };
}
