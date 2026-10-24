import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import sharp from "sharp";
import { Builder } from "../src/build/Builder.ts";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { images } from "../src/plugins/images.ts";
import type { ConfigSetup } from "../src/types.ts";

const roots: string[] = [];

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const photo = (width: number, height: number, alpha = false): Promise<Buffer> => sharp({
    create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 200, g: 50, b: 50, alpha: 0.5 } : "#c83232" },
}).png().toBuffer();

async function site(files: Record<string, string | Promise<Buffer>>): Promise<string> {
    const root = mkdtempSync(join(tmpdir(), "nugo-images-"));
    roots.push(root);

    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), await content);
    }

    return root;
}

const setup = (options = {}): ConfigSetup => (nugo) => {
    nugo.site({ url: "https://example.org" });
    nugo.collection("posts", { dir: "blog", template: "post", assetFields: ["cover"] });
    nugo.use(images({ widths: [400, 800], ...options }));
};

const build = async (root: string, config: ConfigSetup) => Builder.run(root, await ConfigLoader.fromSetup(config));
const read = (root: string, path: string): string => readFileSync(join(root, "build", path), "utf-8");

const TEMPLATE = "{{#with (image cover)}}<img src=\"{{src}}\" srcset=\"{{srcset}}\" data-webp=\"{{sources.0.srcset}}\" width=\"{{width}}\" height=\"{{height}}\">{{else}}<img src=\"{{cover}}\">{{/with}}{{{entry.html}}}";

describe("images", () => {
    it("turns local Markdown images into <picture> with WebP and JPEG variants", async () => {
        const root = await site({
            "content/blog/post/index.md": "---\ncover: cover.png\n---\n![A photo](photo.png \"Title\")",
            "content/blog/post/photo.png": photo(1000, 500),
            "content/blog/post/cover.png": photo(300, 200),
            "templates/post.hbs": TEMPLATE,
        });

        await build(root, setup({ sizes: "50vw" }));
        const html = read(root, "blog/post/index.html");

        // plafonnée à la plus grande largeur demandée
        assert.match(html, /<picture><source type="image\/webp" srcset="\/blog\/post\/photo-400w\.webp 400w, \/blog\/post\/photo-800w\.webp 800w" sizes="50vw">/);
        assert.match(html, /<img src="\/blog\/post\/photo-800w\.jpg" alt="A photo" title="Title" srcset="\/blog\/post\/photo-400w\.jpg 400w, \/blog\/post\/photo-800w\.jpg 800w" sizes="50vw" width="800" height="400" loading="lazy" decoding="async"><\/picture>/);
        // une image plus petite que toutes les largeurs garde sa taille d'origine
        assert.match(html, /^<img src="\/blog\/post\/cover-300w\.jpg" srcset="\/blog\/post\/cover-300w\.jpg 300w" data-webp="\/blog\/post\/cover-300w\.webp 300w" width="300" height="200">/);

        const variant = await sharp(join(root, "build/blog/post/photo-800w.webp")).metadata();
        assert.deepEqual([variant.format, variant.width, variant.height], ["webp", 800, 400]);
        assert.equal((await sharp(join(root, "build/blog/post/photo-400w.jpg")).metadata()).format, "jpeg");
        assert.ok(existsSync(join(root, "build/blog/post/photo.png")));
    });

    it("keeps transparency with a PNG fallback", async () => {
        const root = await site({
            "content/blog/post/index.md": "![](logo.png)",
            "content/blog/post/logo.png": photo(500, 500, true),
            "templates/post.hbs": "{{{entry.html}}}",
        });

        await build(root, setup());

        assert.match(read(root, "blog/post/index.html"), /src="\/blog\/post\/logo-500w\.png"/);
        assert.equal((await sharp(join(root, "build/blog/post/logo-400w.png")).metadata()).hasAlpha, true);
    });

    it("leaves external, missing and unsupported images untouched", async () => {
        const root = await site({
            "content/blog/post/index.md": [
                "---",
                "cover: https://cdn.example.com/cover.jpg",
                "---",
                "![](https://cdn.example.com/a.jpg)",
                "![](//cdn.example.com/b.jpg)",
                "![](missing.jpg)",
                "![](icon.svg)",
            ].join("\n"),
            "content/blog/post/icon.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
            "templates/post.hbs": TEMPLATE,
        });

        await build(root, setup());

        assert.equal(read(root, "blog/post/index.html"), [
            "<img src=\"https://cdn.example.com/cover.jpg\"><p><img src=\"https://cdn.example.com/a.jpg\" alt=\"\">",
            "<img src=\"//cdn.example.com/b.jpg\" alt=\"\">",
            "<img src=\"missing.jpg\" alt=\"\">",
            "<img src=\"icon.svg\" alt=\"\"></p>",
        ].join("\n"));
        assert.deepEqual(readdirSync(join(root, "build/blog/post")).sort(), ["icon.svg", "index.html"]);
    });

    it("reuses cached encodings between builds", async () => {
        const root = await site({
            "content/blog/post/index.md": "![](photo.png)",
            "content/blog/post/photo.png": photo(600, 400),
            "templates/post.hbs": "{{{entry.html}}}",
        });
        const cacheDir = join(root, ".nugo-cache/images");

        await build(root, setup());
        const cached = readdirSync(cacheDir).sort();
        assert.equal(cached.length, 4);

        // un encodage déjà en cache n'est pas refait : le fichier garde sa date
        const modified = cached.map((name) => statSync(join(cacheDir, name)).mtimeMs);
        await build(root, setup());
        assert.deepEqual(readdirSync(cacheDir).sort(), cached);
        assert.deepEqual(cached.map((name) => statSync(join(cacheDir, name)).mtimeMs), modified);
        // la variante de la sortie partage le fichier du cache (lien physique), sans doublon sur le disque
        const output = statSync(join(root, "build/blog/post/photo-600w.webp"));
        assert.ok(cached.some((name) => statSync(join(cacheDir, name)).ino === output.ino));

        // l'image change : nouveaux encodages, les anciens sont retirés du cache
        writeFileSync(join(root, "content/blog/post/photo.png"), await photo(600, 400, true));
        await build(root, setup());
        const renewed = readdirSync(cacheDir);
        assert.equal(renewed.length, 4);
        assert.ok(renewed.every((name) => !cached.includes(name)));

        // plus aucune image : le cache est vidé
        rmSync(join(root, "content/blog/post/photo.png"));
        writeFileSync(join(root, "content/blog/post/index.md"), "Texte");
        await build(root, setup());
        assert.deepEqual(readdirSync(cacheDir), []);
    });

    it("crops images to a fixed ratio without enlarging them", async () => {
        const crop = "{{#with (imageCrop cover 1200 630)}}{{src}} {{width}}x{{height}} {{type}}{{else}}none{{/with}}";
        const root = await site({
            "content/blog/large/index.md": "---\ncover: cover.png\n---\n",
            "content/blog/large/cover.png": photo(1600, 1200),
            "content/blog/small/index.md": "---\ncover: cover.png\n---\n",
            "content/blog/small/cover.png": photo(800, 300, true),
            "content/blog/ratio/index.md": "---\ncover: cover.png\n---\n",
            "content/blog/ratio/cover.png": photo(2400, 1260),
            "content/blog/external/index.md": "---\ncover: https://cdn.example.com/cover.jpg\n---\n",
            "templates/post.hbs": crop,
        });

        await build(root, setup());

        assert.equal(read(root, "blog/large/index.html"), "/blog/large/cover-1200x630.jpg 1200x630 image/jpeg");
        assert.equal(read(root, "blog/small/index.html"), "/blog/small/cover-571x300.jpg 571x300 image/jpeg");
        assert.equal(read(root, "blog/ratio/index.html"), "/blog/ratio/cover-1200x630.jpg 1200x630 image/jpeg");
        assert.equal(read(root, "blog/external/index.html"), "none");

        for (const [path, size] of [["large", [1200, 630]], ["small", [571, 300]], ["ratio", [1200, 630]]] as const) {
            const metadata = await sharp(join(root, "build/blog", path, `cover-${size[0]}x${size[1]}.jpg`)).metadata();
            assert.deepEqual([metadata.format, metadata.width, metadata.height], ["jpeg", ...size]);
        }
    });
});
