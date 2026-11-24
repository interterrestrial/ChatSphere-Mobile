export function readConfig() {
    const production = process.env.NODE_ENV === 'production';
    const port = Number(process.env.PORT || 6001);
    const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
    const webOrigins = (process.env.WEB_ORIGINS || process.env.CLIENT_URL || (production ? '' : 'http://localhost:3000'))
        .split(',').map(value => value.trim()).filter(Boolean);
    const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map(value => value.trim()).filter(Boolean);

    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
    if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) {
        throw new Error('TRUST_PROXY_HOPS must be between 0 and 5');
    }
    for (const origin of webOrigins) {
        const url = URL.parse(origin);
        if (!url || url.origin !== origin || !['http:', 'https:'].includes(url.protocol) ||
            (production && url.protocol !== 'https:')) {
            throw new Error('WEB_ORIGINS must contain exact origins and use HTTPS in production');
        }
    }
    return { port, trustProxy, webOrigins, googleClientIds };
}

export function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
    return secret;
}

export function mongoUri() {
    const uri = process.env.MONGO_URI?.trim();
    if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Set MONGO_URI to a MongoDB connection URI');
    return uri;
}
