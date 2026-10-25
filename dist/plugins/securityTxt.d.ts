import type { NugoPlugin } from "../types.ts";
export interface SecurityTxtOptions {
    readonly contact: string;
    readonly expiresInDays?: number;
    readonly preferredLanguages?: readonly string[];
}
export declare function securityTxt(options: SecurityTxtOptions): NugoPlugin;
