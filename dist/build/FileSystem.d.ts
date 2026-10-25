export declare class FileSystem {
    static getFiles(dir: string): string[];
    static removeDirectory(dir: string): void;
    static createDirectory(dir: string): void;
    static copy(source: string, destination: string): void;
    private static collectFiles;
}
