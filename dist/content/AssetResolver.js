import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
export class AssetResolver {
    // une URL externe est gardée telle quelle ; un fichier local donne son URL publique
    static resolve(value, location) {
        if (typeof value === "string" && this.isExternal(value.trim())) {
            return value.trim();
        }
        return this.locate(value, location)?.url;
    }
    // "/x" vise public/ ; un chemin relatif vise le dossier du contenu (index.md) puis public/
    static locate(value, location) {
        if (typeof value !== "string") {
            return undefined;
        }
        const asset = value.trim();
        if (!asset || asset.includes("\\") || this.isExternal(asset)) {
            return undefined;
        }
        const path = asset.replace(/^\/+/, "");
        const candidates = asset.startsWith("/") || !location.colocated
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
    static isExternal(asset) {
        return /^[a-z][a-z0-9+.-]*:/i.test(asset) || asset.startsWith("//");
    }
    static isInside(baseDir, filePath) {
        const relativePath = relative(baseDir, filePath);
        return relativePath !== ""
            && relativePath !== ".."
            && !relativePath.startsWith(`..${sep}`)
            && !isAbsolute(relativePath);
    }
}
