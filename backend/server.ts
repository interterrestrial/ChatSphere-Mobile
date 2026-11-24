import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { jwtSecret, mongoUri, readConfig } from './config';
import { connectDB } from './db/db';
import { initializeSocket } from './utils/socket';

async function startServer() {
    const config = readConfig();
    jwtSecret();
    await connectDB(mongoUri());

    const server = http.createServer(createApp(config));
    const io = initializeSocket(server, config.webOrigins);
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, '0.0.0.0', resolve);
    });
    console.info('ChatSphere API listening on port', config.port);

    async function shutdown() {
        const timeout = setTimeout(() => process.exit(1), 10_000);
        timeout.unref();
        try {
            await io.close();
            await mongoose.disconnect();
        } catch {
            process.exitCode = 1;
        } finally {
            clearTimeout(timeout);
        }
    }
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
}

void startServer().catch(async error => {
    console.error('ChatSphere startup failed', error instanceof Error && error.constructor === Error ? error.message : error?.name);
    await mongoose.disconnect().catch(() => undefined);
    process.exitCode = 1;
});
