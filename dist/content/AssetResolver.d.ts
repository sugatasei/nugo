export interface AssetLocation {
    readonly sourceFile: string;
    readonly entryUrl: string;
    readonly colocated: boolean;
    readonly publicDir: string;
}
export interface LocatedAsset {
    readonly url: string;
    readonly file: string;
}
export declare class AssetResolver {
    static resolve(value: unknown, location: AssetLocation): string | undefined;
    static locate(value: unknown, location: AssetLocation): LocatedAsset | undefined;
    private static isExternal;
    private static isInside;
}
