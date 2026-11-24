import mongoose from 'mongoose';

const RateLimitSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    hits: { type: Number, required: true },
    resetTime: { type: Date, required: true, expires: 0 },
}, { versionKey: false });

export default mongoose.model('RateLimit', RateLimitSchema);
