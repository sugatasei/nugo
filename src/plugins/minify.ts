import { readFileSync, writeFileSync } from "node:fs";
import { extname, relative, sep } from "node:path";
import { FileSystem } from "../build/FileSystem.ts";
import type { NugoPlugin } from "../types.ts";

export interface MinifyOptions {
    // préfixes d'URL ignorés ; par défaut l'interface Pagefind, déjà minifiée
    readonly exclude?: readonly string[];
}

const LOADERS: Readonly<Record<string, "js" | "css">> = { ".js": "js", ".mjs": "js", ".css": "css" };

/**
 * Minifie avec esbuild les fichiers .js, .mjs et .css de la sortie (public/, passthrough, output()), en fin de build.
 * Les fichiers *.min.* et les URL exclues sont laissés tels quels. Aucune transpilation : la syntaxe est conservée,
 * ainsi que les commentaires de licence (/*! … *\/).
 */
export function minify(options: MinifyOptions = {}): NugoPlugin {
    const exclude = options.exclude ?? ["/pagefind/"];

    return (nugo) => {
        nugo.on("afterBuild", async (context) => {
            const files = FileSystem.getFiles(context.dirs.output).filter((file) => {
                const url = `/${relative(context.dirs.output, file).split(sep).join("/")}`;
                return extname(file) in LOADERS && !/\.min\.[^/]+$/.test(url) && !exclude.some((prefix) => url.startsWith(prefix));
            });

            if (files.length === 0) {
                return;
            }

            const { transform } = await import("esbuild");

            await Promise.all(files.map(async (file) => {
                try {
                    const { code } = await transform(readFileSync(file, "utf-8"), { loader: LOADERS[extname(file)], minify: true });
                    writeFileSync(file, code);
                } catch (error) {
                    throw new Error(`Cannot minify ${file}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }));
        });
    };
}
