import type { NugoPlugin } from "../types.ts";
export interface FingerprintOptions {
    readonly extensions?: readonly string[];
    readonly length?: number;
}
/**
 * Ajoute « ?v=<empreinte> » aux URL locales (src, href) des pages HTML qui visent un .js ou un .css de la sortie.
 * L'empreinte vient du contenu final : à déclarer après minify(). Les fichiers gardent leur nom,
 * une page restée en cache avec l'ancienne URL trouve donc toujours son fichier.
 */
export declare function fingerprint(options?: FingerprintOptions): NugoPlugin;
