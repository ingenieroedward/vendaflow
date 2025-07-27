import winston from 'winston';
declare const logger: winston.Logger;
export declare const logStream: {
    write: (message: string) => void;
};
export default logger;
export declare const logInfo: (message: string, meta?: any) => void;
export declare const logError: (message: string, error?: Error, meta?: any) => void;
export declare const logWarn: (message: string, meta?: any) => void;
export declare const logDebug: (message: string, meta?: any) => void;
export declare const logHttp: (message: string, meta?: any) => void;
//# sourceMappingURL=index.d.ts.map