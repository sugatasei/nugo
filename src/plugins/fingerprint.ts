import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { FileSystem } from "../build/FileSystem.ts";
import { OutputWriter } from "../build/OutputWriter.ts";
import type { NugoPlugin } from "../types.ts";

export interface FingerprintOptions {
    // extensions versionnées ; par défaut les scripts et feuilles de style
    readonly extensions?: readonly string[];
    readonly length?: number;
}

const ATTRIBUTE = /\b(src|href)="(\/(?!\/)[^"?#]*)"/g;

/**
 * Ajoute « ?v=<empreinte> » aux URL locales (src, href) des pages HTML qui visent un .js ou un .css de la sortie.
 * L'empreinte vient du contenu final : à déclarer après minify(). Les fichiers gardent leur nom,
 * une page restée en cache avec l'ancienne URL trouve donc toujours son fichier.
 */
export function fingerprint(options: FingerprintOptions = {}): NugoPlugin {
    const extensions = new Set(options.extensions ?? [".js", ".mjs", ".css"]);
    const length = options.length ?? 10;

    return (nugo) => {
        nugo.on("afterBuild", (context) => {
            const hashes = new Map<string, string | undefined>();

            const hashOf = (url: string): string | undefined => {
                if (!hashes.has(url)) {
                    let hash: string | undefined;

                    // URL invalide (« .. », encodage cassé) ou fichier absent : laissée telle quelle
                    try {
                        const file = join(context.dirs.output, OutputWriter.fileForUrl(url));
                        hash = existsSync(file) && statSync(file).isFile()
                            ? createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, length)
                            : undefined;
                    } catch {
                        hash = undefined;
                    }

                    hashes.set(url, hash);
                }

                return hashes.get(url);
            };

            for (const file of FileSystem.getFiles(context.dirs.output).filter((path) => path.endsWith(".html"))) {
                const html = readFileSync(file, "utf-8");
                const versioned = html.replace(ATTRIBUTE, (match, name: string, url: string) => {
                    const hash = extensions.has(extname(url)) ? hashOf(url) : undefined;
                    return hash ? `${name}="${url}?v=${hash}"` : match;
                });

                if (versioned !== html) {
                    writeFileSync(file, versioned);
                }
            }
        });
    };
}
