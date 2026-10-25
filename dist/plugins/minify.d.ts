import type { NugoPlugin } from "../types.ts";
export interface MinifyOptions {
    readonly exclude?: readonly string[];
}
/**
 * Minifie avec esbuild les fichiers .js, .mjs et .css de la sortie (public/, passthrough, output()), en fin de build.
 * Les fichiers *.min.* et les URL exclues sont laissés tels quels. Aucune transpilation : la syntaxe est conservée,
 * ainsi que les commentaires de licence (/*! … *\/).
 */
export declare function minify(options?: MinifyOptions): NugoPlugin;
