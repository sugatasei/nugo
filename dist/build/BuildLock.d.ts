export declare const LOCK_FILE = ".nugo.lock";
export declare class BuildLock {
    static with<T>(root: string, task: () => Promise<T>): Promise<T>;
    private static acquire;
    private static readPid;
    private static isAlive;
}
