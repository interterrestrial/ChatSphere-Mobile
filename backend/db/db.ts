import mongoose from 'mongoose';
import User from '../models/user.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Session from '../models/session.model';
import RateLimit from '../models/rateLimit.model';

export async function connectDB(uri: string, maxPoolSize = 10) {
    mongoose.set('bufferCommands', false);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize, minPoolSize: 0, maxIdleTimeMS: 60_000 });
    await Promise.all([User.init(), Conversation.init(), Message.init(), Session.init(), RateLimit.init()]);
}
