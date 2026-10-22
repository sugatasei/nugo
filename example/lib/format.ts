export const LOCALE = "fr-FR";

export function formatDate(date: string): string {
    return new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" })
        .format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

export function formatMonth(month: string): string {
    const label = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));

    return label.charAt(0).toUpperCase() + label.slice(1);
}

// « Articles d’août 2026 » / « Articles de mars 2026 »
export function monthArchiveTitle(month: string): string {
    const label = formatMonth(month).toLocaleLowerCase(LOCALE);
    const prefix = /^[aeiouyàâäéèêëîïôöùûü]/.test(label) ? "d’" : "de ";

    return `Articles ${prefix}${label}`;
}

export function countLabel(count: number): string {
    return `${count} article${count > 1 ? "s" : ""}`;
}
