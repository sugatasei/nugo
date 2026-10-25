import type { Entry, EntrySection, NugoPlugin } from "../types.ts";
export interface SearchOptions {
    readonly language: string;
    readonly collections?: readonly string[];
    readonly path?: string;
    readonly sections?: boolean;
    readonly meta?: (entry: Entry, section?: EntrySection) => Readonly<Record<string, string | undefined>>;
    readonly filters?: (entry: Entry) => Readonly<Record<string, readonly string[] | undefined>>;
    readonly sort?: (entry: Entry) => Readonly<Record<string, string | undefined>>;
}
/**
 * Index Pagefind construit depuis les entrées (front matter + texte Markdown), sans relire le HTML.
 * Par défaut, chaque section (texte entre deux titres) est un résultat qui pointe sur l'ancre de son titre,
 * titré « Titre de l'entrée › Titre de la section ».
 * Écrit l'index et l'interface Pagefind (pagefind-ui.js / .css) dans <output>/<path>.
 */
export declare function search(options: SearchOptions): NugoPlugin;
