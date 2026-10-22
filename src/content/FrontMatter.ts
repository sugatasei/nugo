import { parse as parseYaml } from "yaml";

export type FrontMatterDelimiters = readonly [open: string, close: string];

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface ParsedDocument {
    readonly data: Record<string, unknown>;
    readonly body: string;
}

export class FrontMatter {
    // le front matter est remplacé par des lignes vides : les positions Markdown restent celles du fichier
    static parse(content: string, filePath: string, [open, close]: FrontMatterDelimiters = ["---", "---"]): ParsedDocument {
        const pattern = new RegExp(`^${escape(open)}[ \\t]*\\r?\\n(?:([\\s\\S]*?)\\r?\\n)?${escape(close)}[ \\t]*(?:\\r?\\n|$)`);
        const match = content.match(pattern);

        if (!match) {
            return { data: {}, body: content };
        }

        const data: unknown = parseYaml(match[1] ?? "") ?? {};

        if (typeof data !== "object" || data === null || Array.isArray(data)) {
            throw new Error(`${filePath} front matter must be a YAML mapping`);
        }

        const lines = (match[0].match(/\n/g) ?? []).length;

        return {
            data: data as Record<string, unknown>,
            body: "\n".repeat(lines) + content.slice(match[0].length),
        };
    }
}
