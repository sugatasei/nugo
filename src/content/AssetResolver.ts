import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export interface AssetLocation {
    readonly sourceFile: string;
    readonly entryUrl: string;
    readonly colocated: boolean;
    readonly publicDir: string;
}

export class AssetResolver {
    // "/x" vise public/ ; un chemin relatif vise le dossier du contenu (index.md) puis public/
    static resolve(value: unknown, location: AssetLocation): string | undefined {
        if (typeof value !== "string") {
            return undefined;
        }

        const asset = value.trim();

        if (!asset || asset.includes("\\")) {
            return undefined;
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(asset)) {
            return asset;
        }

        const path = asset.replace(/^\/+/, "");
        const candidates: Array<readonly [string, string]> = asset.startsWith("/") || !location.colocated
            ? [[location.publicDir, "/"]]
            : [[dirname(location.sourceFile), location.entryUrl], [location.publicDir, "/"]];

        for (const [baseDir, baseUrl] of candidates) {
            const filePath = resolve(baseDir, path);

            if (this.isInside(baseDir, filePath) && existsSync(filePath) && statSync(filePath).isFile()) {
                return baseUrl + path.split("/").map((part) => encodeURIComponent(part)).join("/");
            }
        }

        return undefined;
    }

    private static isInside(baseDir: string, filePath: string): boolean {
        const relativePath = relative(baseDir, filePath);

        return relativePath !== ""
            && relativePath !== ".."
            && !relativePath.startsWith(`..${sep}`)
            && !isAbsolute(relativePath);
    }
}
