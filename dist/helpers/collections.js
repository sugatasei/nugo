import { slugify } from "./text.js";
const DATE_LENGTHS = { year: 4, month: 7, day: 10 };
export function paginate(items, size, url) {
    if (!Number.isInteger(size) || size < 1) {
        throw new Error(`Page size must be a positive integer (got ${size})`);
    }
    const total = Math.max(1, Math.ceil(items.length / size));
    return Array.from({ length: total }, (_, index) => ({
        number: index + 1,
        total,
        items: items.slice(index * size, (index + 1) * size),
        url: url(index + 1),
        previous: index > 0 ? url(index) : undefined,
        next: index + 1 < total ? url(index + 2) : undefined,
    }));
}
// conserve l'ordre de première apparition des clés
export function groupBy(items, key) {
    const groups = new Map();
    for (const item of items) {
        const value = key(item);
        if (value !== undefined) {
            groups.set(value, [...(groups.get(value) ?? []), item]);
        }
    }
    return [...groups].map(([groupKey, groupItems]) => ({ key: groupKey, items: groupItems }));
}
export function groupByDate(entries, precision, field = "date") {
    return groupBy(entries, (entry) => {
        const value = entry.data[field];
        const date = value instanceof Date ? value.toISOString() : value;
        if (typeof date !== "string") {
            throw new Error(`${entry.src} has no "${field}" date`);
        }
        return date.slice(0, DATE_LENGTHS[precision]);
    });
}
// regroupe par slug : deux libellés qui donnent le même slug forment un seul terme (le premier rencontré)
export function taxonomy(entries, field = "tags", options = {}) {
    const terms = new Map();
    for (const entry of entries) {
        const values = entry.data[field];
        const seen = new Set();
        for (const label of Array.isArray(values) ? values : []) {
            if (typeof label !== "string" || !label.trim()) {
                continue;
            }
            const slug = slugify(label, options);
            if (seen.has(slug)) {
                continue;
            }
            seen.add(slug);
            const term = terms.get(slug);
            if (term) {
                term.items.push(entry);
            }
            else {
                terms.set(slug, { label, items: [entry] });
            }
        }
    }
    return [...terms]
        .map(([slug, term]) => ({ slug, label: term.label, items: term.items }))
        .sort((left, right) => left.label.localeCompare(right.label, options.locale, { sensitivity: "base" }));
}
export function latestUpdate(entries) {
    return entries.reduce((latest, entry) => !latest || entry.updatedAt > latest ? entry.updatedAt : latest, undefined);
}
