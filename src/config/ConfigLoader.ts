import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ConfigSetup } from "../types.ts";
import { ConfigBuilder, type ResolvedConfig } from "./ConfigBuilder.ts";

const CONFIG_FILES = ["nugo.config.ts", "nugo.config.mts", "nugo.config.js", "nugo.config.mjs"];

export interface ConfigOverrides {
    // remplace site.url, ex. l'adresse locale en mode dev
    readonly url?: string;
}

export class ConfigLoader {
    static async load(root: string, overrides: ConfigOverrides = {}): Promise<ResolvedConfig> {
        const file = CONFIG_FILES.map((name) => join(root, name)).find((path) => existsSync(path));

        if (!file) {
            throw new Error(`No ${CONFIG_FILES.join(" / ")} found in ${root}`);
        }

        const module: { default?: unknown } = await import(pathToFileURL(file).href);

        if (typeof module.default !== "function") {
            throw new Error(`${file} must export a default function`);
        }

        return this.fromSetup(module.default as ConfigSetup, overrides);
    }

    static async fromSetup(setup: ConfigSetup, overrides: ConfigOverrides = {}): Promise<ResolvedConfig> {
        const builder = new ConfigBuilder();
        await setup(builder);

        if (overrides.url) {
            builder.site({ url: overrides.url });
        }

        return builder.resolve();
    }
}
