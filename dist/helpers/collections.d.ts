import type { Entry } from "../types.ts";
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
export declare function paginate<T>(items: readonly T[], size: number, url: (number: number) => string): Pagination<T>[];
export declare function groupBy<T>(items: readonly T[], key: (item: T) => string | undefined): Group<T>[];
export declare function groupByDate<T extends Entry>(entries: readonly T[], precision: DatePrecision, field?: string): Group<T>[];
export declare function taxonomy<T extends Entry>(entries: readonly T[], field?: string, options?: {
    readonly locale?: string;
}): Term<T>[];
export declare function latestUpdate(entries: readonly Entry[]): string | undefined;
