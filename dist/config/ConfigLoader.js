var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ConfigBuilder } from "./ConfigBuilder.js";
const CONFIG_FILES = ["nugo.config.ts", "nugo.config.mts", "nugo.config.js", "nugo.config.mjs"];
export class ConfigLoader {
    static async load(root, overrides = {}) {
        const file = CONFIG_FILES.map((name) => join(root, name)).find((path) => existsSync(path));
        if (!file) {
            throw new Error(`No ${CONFIG_FILES.join(" / ")} found in ${root}`);
        }
        const module = await import(__rewriteRelativeImportExtension(pathToFileURL(file).href));
        if (typeof module.default !== "function") {
            throw new Error(`${file} must export a default function`);
        }
        return this.fromSetup(module.default, overrides);
    }
    static async fromSetup(setup, overrides = {}) {
        const builder = new ConfigBuilder();
        await setup(builder);
        if (overrides.url) {
            builder.site({ url: overrides.url });
        }
        return builder.resolve();
    }
}
