import { Types } from 'mongoose';

export class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

export function objectId(value: unknown, field: string) {
    if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
        throw new HttpError(400, `Invalid ${field}`);
    }
    return new Types.ObjectId(value);
}

export function duplicateKey(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export function textField(value: unknown, max: number) {
    return typeof value === 'string' && value.length <= max ? value.trim() : '';
}
