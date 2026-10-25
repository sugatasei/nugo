export interface DevServerOptions {
    readonly root: string;
    readonly port: number;
    readonly cli: string;
}
export declare class DevServer {
    private readonly clients;
    private readonly options;
    private outputDir;
    private building;
    private pending;
    private timer?;
    constructor(options: DevServerOptions);
    start(): Promise<void>;
    private build;
    private handle;
    private send;
}
