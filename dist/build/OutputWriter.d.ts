export declare class OutputWriter {
    private readonly written;
    private readonly dir;
    constructor(dir: string);
    static fileForUrl(url: string): string;
    write(file: string, content: string | Uint8Array): void;
    copy(source: string, file: string): void;
    private reserve;
}
