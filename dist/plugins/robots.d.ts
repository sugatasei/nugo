import type { NugoPlugin } from "../types.ts";
export interface RobotsOptions {
    readonly rules?: readonly string[];
    readonly sitemap?: string | false;
}
export declare function robots(options?: RobotsOptions): NugoPlugin;
