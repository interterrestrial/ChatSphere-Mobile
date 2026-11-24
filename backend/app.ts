import express, { type ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notifications.routes';
import { readConfig } from './config';
import { HttpError } from './http';

export function createApp(config = readConfig()) {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', config.trustProxy);
    app.use(helmet());
    app.use(cors({ origin: config.webOrigins }));

    app.get('/', (_req, res) => { res.json({ service: 'ChatSphere API' }); });
    app.get('/health/live', (_req, res) => { res.set('Cache-Control', 'no-store').json({ status: 'ok' }); });
    app.get('/health/ready', (_req, res) => {
        const ready = mongoose.connection.readyState === 1;
        res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
    });
    app.use('/api', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (mongoose.connection.readyState !== 1) return next(new HttpError(503, 'API unavailable. Try again shortly'));
        next();
    }, rateLimit({
        windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false,
        message: { message: 'Too many requests. Try again shortly' },
    }), express.json({ limit: '32kb' }));

    app.use('/api/auth', authRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use((_req, res) => { res.status(404).json({ message: 'Route not found' }); });

    const handleError: ErrorRequestHandler = (error: unknown, req, res, next) => {
        if (res.headersSent) return next(error);
        if (error instanceof HttpError) {
            res.status(error.status).json({ message: error.message });
            return;
        }
        const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
        if (status === 400 || status === 413) {
            res.status(status).json({ message: status === 413 ? 'Request is too large' : 'Invalid request body' });
            return;
        }
        console.error('Unhandled API error', { method: req.method, route: req.route?.path, name: error instanceof Error ? error.name : 'Unknown' });
        res.status(500).json({ message: 'Something went wrong. Try again' });
    };
    app.use(handleError);
    return app;
}
