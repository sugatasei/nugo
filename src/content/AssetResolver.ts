import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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

export class AssetResolver {
    // une URL externe est gardée telle quelle ; un fichier local donne son URL publique
    static resolve(value: unknown, location: AssetLocation): string | undefined {
        if (typeof value === "string" && this.isExternal(value.trim())) {
            return value.trim();
        }

        return this.locate(value, location)?.url;
    }

    // "/x" vise public/ ; un chemin relatif vise le dossier du contenu (index.md) puis public/
    static locate(value: unknown, location: AssetLocation): LocatedAsset | undefined {
        if (typeof value !== "string") {
            return undefined;
        }

        const asset = value.trim();

        if (!asset || asset.includes("\\") || this.isExternal(asset)) {
            return undefined;
        }

        const path = asset.replace(/^\/+/, "");
        const candidates: Array<readonly [string, string]> = asset.startsWith("/") || !location.colocated
            ? [[location.publicDir, "/"]]
            : [[dirname(location.sourceFile), location.entryUrl], [location.publicDir, "/"]];

        for (const [baseDir, baseUrl] of candidates) {
            const filePath = resolve(baseDir, path);

            if (this.isInside(baseDir, filePath) && existsSync(filePath) && statSync(filePath).isFile()) {
                return { url: baseUrl + path.split("/").map((part) => encodeURIComponent(part)).join("/"), file: filePath };
            }
        }

        return undefined;
    }

    private static isExternal(asset: string): boolean {
        return /^[a-z][a-z0-9+.-]*:/i.test(asset) || asset.startsWith("//");
    }

    private static isInside(baseDir: string, filePath: string): boolean {
        const relativePath = relative(baseDir, filePath);

        return relativePath !== ""
            && relativePath !== ".."
            && !relativePath.startsWith(`..${sep}`)
            && !isAbsolute(relativePath);
    }
}
