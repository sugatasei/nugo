import type { NugoPlugin } from "../types.ts";
export interface ImagesOptions {
    readonly widths?: readonly number[];
    readonly sizes?: string;
    readonly quality?: {
        readonly webp?: number;
        readonly jpeg?: number;
    };
    readonly helper?: string;
    readonly cropHelper?: string;
    readonly crop?: {
        readonly position?: string;
    };
    readonly cacheDir?: string;
}
export interface ImageSource {
    readonly type: string;
    readonly srcset: string;
}
export interface ResponsiveImage {
    readonly src: string;
    readonly width: number;
    readonly height: number;
    readonly srcset: string;
    readonly sources: readonly ImageSource[];
}
export interface CroppedImage {
    readonly src: string;
    readonly width: number;
    readonly height: number;
    readonly type: string;
}
/**
 * Variantes des images locales (plusieurs largeurs, WebP + repli JPEG, PNG si transparence).
 * Dans le Markdown, chaque <img> local devient un <picture> ; les images externes restent intactes.
 * Les gabarits obtiennent les mêmes données avec le helper `image` (ex. {{#with (image cover)}}),
 * et une image recadrée à dimensions fixes avec `imageCrop` (ex. {{#with (imageCrop cover 1200 630)}} pour og:image).
 * Les encodages sont mis en cache, le serveur de dev ne refait que les nouveaux.
 */
export declare function images(options?: ImagesOptions): NugoPlugin;
