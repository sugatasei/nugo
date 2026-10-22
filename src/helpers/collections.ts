import type { Entry } from "../types.ts";
import { slugify } from "./text.ts";

export interface Pagination<T> {
    readonly number: number;
    readonly total: number;
    readonly items: readonly T[];
    readonly url: string;
    readonly previous?: string;
    readonly next?: string;
}

export interface Group<T> {
    readonly key: string;
    readonly items: readonly T[];
}

export interface Term<T> {
    readonly label: string;
    readonly slug: string;
    readonly items: readonly T[];
}

export type DatePrecision = "year" | "month" | "day";

const DATE_LENGTHS: Readonly<Record<DatePrecision, number>> = { year: 4, month: 7, day: 10 };

export function paginate<T>(items: readonly T[], size: number, url: (number: number) => string): Pagination<T>[] {
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
export function groupBy<T>(items: readonly T[], key: (item: T) => string | undefined): Group<T>[] {
    const groups = new Map<string, T[]>();

    for (const item of items) {
        const value = key(item);

        if (value !== undefined) {
            groups.set(value, [...(groups.get(value) ?? []), item]);
        }
    }

    return [...groups].map(([groupKey, groupItems]) => ({ key: groupKey, items: groupItems }));
}

export function groupByDate<T extends Entry>(entries: readonly T[], precision: DatePrecision, field = "date"): Group<T>[] {
    return groupBy(entries, (entry) => {
        const value: unknown = entry.data[field];
        const date = value instanceof Date ? value.toISOString() : value;

        if (typeof date !== "string") {
            throw new Error(`${entry.src} has no "${field}" date`);
        }

        return date.slice(0, DATE_LENGTHS[precision]);
    });
}

// regroupe par slug : deux libellés qui donnent le même slug forment un seul terme (le premier rencontré)
export function taxonomy<T extends Entry>(
    entries: readonly T[],
    field = "tags",
    options: { readonly locale?: string } = {},
): Term<T>[] {
    const terms = new Map<string, { label: string; items: T[] }>();

    for (const entry of entries) {
        const values: unknown = entry.data[field];
        const seen = new Set<string>();

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
            } else {
                terms.set(slug, { label, items: [entry] });
            }
        }
    }

    return [...terms]
        .map(([slug, term]) => ({ slug, label: term.label, items: term.items }))
        .sort((left, right) => left.label.localeCompare(right.label, options.locale, { sensitivity: "base" }));
}

export function latestUpdate(entries: readonly Entry[]): string | undefined {
    return entries.reduce<string | undefined>(
        (latest, entry) => !latest || entry.updatedAt > latest ? entry.updatedAt : latest,
        undefined,
    );
}
