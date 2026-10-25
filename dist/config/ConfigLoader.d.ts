import type { ConfigSetup } from "../types.ts";
import { type ResolvedConfig } from "./ConfigBuilder.ts";
export interface ConfigOverrides {
    readonly url?: string;
}
export declare class ConfigLoader {
    static load(root: string, overrides?: ConfigOverrides): Promise<ResolvedConfig>;
    static fromSetup(setup: ConfigSetup, overrides?: ConfigOverrides): Promise<ResolvedConfig>;
}
