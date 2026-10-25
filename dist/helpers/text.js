const CHARACTER_REPLACEMENTS = [
    [/[ÄäÆæǼǽ]/gu, "ae"],
    [/[ÖöŒœ]/gu, "oe"],
    [/[Üü]/gu, "ue"],
    [/[Ĳĳ]/gu, "ij"],
    [/[ẞß]/gu, "ss"],
];
export function slugify(value, options = {}) {
    let slug = value;
    for (const [pattern, replacement] of CHARACTER_REPLACEMENTS) {
        slug = slug.replace(pattern, replacement);
    }
    slug = slug
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase(options.locale)
        .replace(/[^a-z0-9+#]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!slug) {
        throw new Error(`"${value}" has no usable slug`);
    }
    return slug;
}
export function escapeXml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
// JSON sûr à insérer dans un <script> (JSON-LD, données embarquées)
export function safeJson(data) {
    return JSON.stringify(data)
        .replaceAll("<", "\\u003c")
        .replaceAll(">", "\\u003e")
        .replaceAll("&", "\\u0026")
        .replaceAll(" ", "\\u2028")
        .replaceAll(" ", "\\u2029");
}
export function absoluteUrl(siteUrl, path) {
    return new URL(path, `${siteUrl.replace(/\/+$/, "")}/`).href;
}
