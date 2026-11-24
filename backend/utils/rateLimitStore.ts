import { createHash } from 'node:crypto';
import type { Options, Store } from 'express-rate-limit';
import { duplicateKey } from '../http';
import RateLimit from '../models/rateLimit.model';

export class MongoRateLimitStore implements Store {
    localKeys = false;
    private windowMs = 60_000;

    constructor(readonly prefix: string) {}

    init({ windowMs }: Options) {
        this.windowMs = windowMs;
    }

    private bucket(key: string) {
        const start = Math.floor(Date.now() / this.windowMs) * this.windowMs;
        const identity = createHash('sha256').update(key).digest('hex');
        return {
            _id: `${this.prefix}:${start}:${identity}`,
            resetTime: new Date(start + this.windowMs),
        };
    }

    async increment(key: string) {
        const { _id, resetTime } = this.bucket(key);
        const hit = () => RateLimit.findOneAndUpdate({ _id }, {
            $inc: { hits: 1 }, $setOnInsert: { resetTime },
        }, { upsert: true, returnDocument: 'after' }).lean();
        const record = await hit().catch((error: unknown) => {
            if (!duplicateKey(error)) throw error;
            return hit();
        });
        if (!record) throw new Error('Cannot update rate limit');
        return { totalHits: record.hits, resetTime };
    }

    async decrement(key: string) {
        await RateLimit.updateOne({ _id: this.bucket(key)._id, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
    }

    async resetKey(key: string) {
        await RateLimit.deleteOne({ _id: this.bucket(key)._id });
    }
}
