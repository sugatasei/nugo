export type FrontMatterDelimiters = readonly [open: string, close: string];
export interface ParsedDocument {
    readonly data: Record<string, unknown>;
    readonly body: string;
}
export declare class FrontMatter {
    static parse(content: string, filePath: string, [open, close]?: FrontMatterDelimiters): ParsedDocument;
}
