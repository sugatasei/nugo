import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Element, Root } from "hast";
import { imageSize } from "image-size";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { OutputWriter } from "../build/OutputWriter.ts";
import { AssetResolver } from "../content/AssetResolver.ts";
import type { BuildContext, NugoPlugin } from "../types.ts";

export interface ImagesOptions {
    // largeurs des variantes, en pixels ; jamais plus large que l'original
    readonly widths?: readonly number[];
    // attribut sizes des images du Markdown
    readonly sizes?: string;
    readonly quality?: { readonly webp?: number; readonly jpeg?: number };
    // nom du helper Handlebars qui donne les variantes d'une URL (ex. une cover)
    readonly helper?: string;
    // relatif à la racine du site
    readonly cacheDir?: string;
}

export interface ImageSource {
    readonly type: string;
    readonly srcset: string;
}

// données d'une image responsive : le site écrit lui-même son <picture> dans ses gabarits
export interface ResponsiveImage {
    readonly src: string;
    readonly width: number;
    readonly height: number;
    readonly srcset: string;
    readonly sources: readonly ImageSource[];
}

type Format = "webp" | "jpeg" | "png";

interface Variant {
    readonly url: string;
    readonly file: string;
    readonly hash: string;
    readonly width: number;
    readonly format: Format;
}

const DEFAULT_WIDTHS = [480, 800, 1200, 1600];
// GIF (animations) et SVG restent tels quels
const SUPPORTED_TYPES = new Set(["jpg", "png", "webp", "avif", "tiff"]);
const EXTENSIONS: Readonly<Record<Format, string>> = { webp: "webp", jpeg: "jpg", png: "png" };

// canal alpha d'un PNG (type de couleur ou chunk tRNS) ou d'un WebP (VP8X, VP8L)
function hasAlpha(buffer: Buffer, type: string): boolean {
    if (type === "png") {
        const transparency = buffer.indexOf("tRNS");
        return buffer[25] === 4 || buffer[25] === 6 || (transparency !== -1 && transparency < buffer.indexOf("IDAT"));
    }

    if (type === "webp") {
        const chunk = buffer.toString("ascii", 12, 16);
        return chunk === "VP8X" ? ((buffer[20] ?? 0) & 0x10) !== 0 : chunk === "VP8L" && ((buffer.readUInt32LE(21) >> 28) & 1) === 1;
    }

    return false;
}

// variantes d'un build : planifiées pendant le rendu, encodées dans afterBuild
class ImageSet {
    readonly variants = new Map<string, Variant>();
    private readonly planned = new Map<string, ResponsiveImage | undefined>();
    private readonly widths: readonly number[];

    constructor(widths: readonly number[]) {
        this.widths = [...new Set(widths)].sort((left, right) => left - right);
    }

    plan(url: string, file: string): ResponsiveImage | undefined {
        if (!this.planned.has(url)) {
            this.planned.set(url, this.compute(url, file));
        }

        return this.planned.get(url);
    }

    private compute(url: string, file: string): ResponsiveImage | undefined {
        const buffer = readFileSync(file);
        let size: ReturnType<typeof imageSize>;

        try {
            size = imageSize(buffer);
        } catch {
            return undefined;
        }

        if (!size.type || !SUPPORTED_TYPES.has(size.type) || !size.width || !size.height) {
            return undefined;
        }

        // orientation EXIF 5 à 8 : l'image affichée est tournée d'un quart de tour
        const rotated = (size.orientation ?? 1) >= 5;
        const original = { width: rotated ? size.height : size.width, height: rotated ? size.width : size.height };
        const widths = this.widths.filter((width) => width < original.width);

        if (widths.length < this.widths.length) {
            widths.push(original.width);
        }

        const hash = createHash("sha1").update(buffer).digest("hex");
        const fallback: Format = hasAlpha(buffer, size.type) ? "png" : "jpeg";
        const base = url.replace(/\.[^./]*$/, "");
        const srcset = (format: Format): string => widths
            .map((width) => {
                const variant: Variant = { url: `${base}-${width}w.${EXTENSIONS[format]}`, file, hash, width, format };
                this.variants.set(variant.url, variant);
                return `${variant.url} ${width}w`;
            })
            .join(", ");
        const largest = widths.at(-1) ?? original.width;

        return {
            src: `${base}-${largest}w.${EXTENSIONS[fallback]}`,
            width: largest,
            height: Math.round(original.height * largest / original.width),
            srcset: srcset(fallback),
            sources: [{ type: "image/webp", srcset: srcset("webp") }],
        };
    }
}

function picture(img: Element, image: ResponsiveImage, sizes: string): Element {
    return {
        type: "element",
        tagName: "picture",
        properties: {},
        children: [
            ...image.sources.map((source): Element => ({
                type: "element",
                tagName: "source",
                properties: { type: source.type, srcSet: source.srcset, sizes },
                children: [],
            })),
            {
                ...img,
                properties: {
                    ...img.properties,
                    src: image.src,
                    srcSet: image.srcset,
                    sizes,
                    width: image.width,
                    height: image.height,
                    loading: "lazy",
                    decoding: "async",
                },
            },
        ],
    };
}

async function encode(variants: Iterable<Variant>, context: BuildContext, options: ImagesOptions): Promise<void> {
    const { default: sharp } = await import("sharp");
    const cacheDir = resolve(context.root, options.cacheDir ?? "node_modules/.cache/nugo/images");
    const queue = [...variants];
    const quality = { webp: options.quality?.webp ?? 80, jpeg: options.quality?.jpeg ?? 82 };

    mkdirSync(cacheDir, { recursive: true });

    const run = async (variant: Variant): Promise<void> => {
        const settings = { width: variant.width, format: variant.format, quality };
        const key = createHash("sha1").update(variant.hash).update(JSON.stringify(settings)).digest("hex");
        const cached = join(cacheDir, `${key}.${EXTENSIONS[variant.format]}`);
        const output = join(context.dirs.output, OutputWriter.fileForUrl(variant.url));

        if (!existsSync(cached)) {
            const image = sharp(variant.file).rotate().resize({ width: variant.width, withoutEnlargement: true });
            const encoded = variant.format === "webp"
                ? image.webp({ quality: quality.webp })
                : variant.format === "jpeg" ? image.flatten({ background: "#ffffff" }).jpeg({ quality: quality.jpeg, mozjpeg: true }) : image.png({ compressionLevel: 9 });
            const temporary = `${cached}.${process.pid}.tmp`;

            await encoded.toFile(temporary);
            renameSync(temporary, cached);
        }

        if (existsSync(output)) {
            throw new Error(`${variant.url} already exists (image variant of ${variant.file})`);
        }

        mkdirSync(dirname(output), { recursive: true });
        copyFileSync(cached, output);
    };

    const worker = async (): Promise<void> => {
        for (let variant = queue.shift(); variant; variant = queue.shift()) {
            await run(variant);
        }
    };

    await Promise.all(Array.from({ length: Math.min(availableParallelism(), queue.length) }, worker));
}

/**
 * Variantes des images locales (plusieurs largeurs, WebP + repli JPEG, PNG si transparence).
 * Dans le Markdown, chaque <img> local devient un <picture> ; les images externes restent intactes.
 * Les gabarits obtiennent les mêmes données avec le helper `image` (ex. {{#with (image cover)}}).
 * Les encodages sont mis en cache, le serveur de dev ne refait que les nouveaux.
 */
export function images(options: ImagesOptions = {}): NugoPlugin {
    const sizes = options.sizes ?? "100vw";
    let context: BuildContext | undefined;
    let set: ImageSet | undefined;

    const pictures = () => (tree: Root, file: VFile) => {
        const entry = file.data.entry;

        if (!context || !set || !entry) {
            return;
        }

        const location = {
            sourceFile: file.path,
            entryUrl: entry.url,
            colocated: entry.src === "index.md" || entry.src.endsWith("/index.md"),
            publicDir: context.dirs.public,
        };

        visit(tree, "element", (node, index, parent) => {
            if (node.tagName !== "img" || !parent || index === undefined) {
                return undefined;
            }

            const asset = AssetResolver.locate(node.properties.src, location);
            const image = asset && set?.plan(asset.url, asset.file);

            if (!image) {
                return undefined;
            }

            parent.children[index] = picture(node, image, sizes);
            return SKIP;
        });
    };

    return (nugo) => {
        nugo
            .on("beforeBuild", (build) => {
                context = build;
                set = new ImageSet(options.widths ?? DEFAULT_WIDTHS);
            })
            .rehype(pictures)
            .helper(options.helper ?? "image", (url: unknown) => {
                const file = typeof url === "string" ? context?.assetFile(url) : undefined;
                return file ? set?.plan(url as string, file) : undefined;
            })
            .on("afterBuild", async (build) => {
                if (set?.variants.size) {
                    await encode(set.variants.values(), build, options);
                }
            });
    };
}
