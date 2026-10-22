import type { NugoPlugin } from "../types.ts";

export interface SecurityTxtOptions {
    readonly contact: string;
    readonly expiresInDays?: number;
    readonly preferredLanguages?: readonly string[];
}

export function securityTxt(options: SecurityTxtOptions): NugoPlugin {
    return (nugo) => {
        nugo.output(".well-known/security.txt", (context) => {
            const expires = new Date(Date.now() + (options.expiresInDays ?? 180) * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, "Z");
            const contact = options.contact.includes(":") ? options.contact : `mailto:${options.contact}`;

            return [
                `Contact: ${contact}`,
                `Expires: ${expires}`,
                `Canonical: ${context.absoluteUrl("/.well-known/security.txt")}`,
                ...(options.preferredLanguages?.length ? [`Preferred-Languages: ${options.preferredLanguages.join(", ")}`] : []),
                "",
            ].join("\n");
        });
    };
}
