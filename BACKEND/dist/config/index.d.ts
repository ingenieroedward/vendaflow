export declare const config: {
    server: {
        port: string | number;
        nodeEnv: string;
    };
    database: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
        dialect: any;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    cors: {
        origin: string;
    };
    logging: {
        level: string;
        maxFiles: string;
        maxSize: string;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map