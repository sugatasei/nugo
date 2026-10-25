import type { ResolvedConfig } from "../config/ConfigBuilder.ts";
import type { Entry, RenderedPage } from "../types.ts";
export interface BuildResult {
    readonly pages: readonly RenderedPage[];
    readonly entries: readonly Entry[];
}
export declare class Builder {
    static run(root: string, config: ResolvedConfig): Promise<BuildResult>;
    private static build;
    private static copyColocatedAssets;
    private static belongsToNestedBundle;
}
