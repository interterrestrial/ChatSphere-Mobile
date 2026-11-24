import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import PushDevice from '../models/pushDevice.model';
import Session from '../models/session.model';
import { RetryablePushError, sendFirebasePush } from './firebasePush';

export const pushLifetimeSeconds = 15 * 60;
export const pushMessageTopic = 'chatsphere-message-push';

export async function deliverMessagePush(messageId: string, send = sendFirebasePush) {
    const message = await Message.findById(messageId)
        .select('_id conversationId senderId createdAt pushDeliveredTo').lean();
    if (!message || Date.now() - message.createdAt.getTime() >= pushLifetimeSeconds * 1000) return;

    const conversation = await Conversation.findById(message.conversationId).select('participants readThrough').lean();
    if (!conversation) return;
    const sender = message.senderId.toString();
    const recipients = conversation.participants.filter(participant => {
        const userId = participant.toString();
        const read = conversation.readThrough?.[userId]?.toString();
        return userId !== sender && (!read || read < messageId);
    });
    if (!recipients.length) return;

    const now = new Date();
    const devices = await PushDevice.find({
        userId: { $in: recipients }, expiresAt: { $gt: now }, _id: { $nin: message.pushDeliveredTo ?? [] },
    }).select('_id userId sessionId registrationToken').sort({ updatedAt: -1 }).limit(20).lean();
    const sessions = await Session.find({
        _id: { $in: devices.map(device => device.sessionId) }, expiresAt: { $gt: now },
    }).select('userId').lean();
    const owners = new Map(sessions.map(session => [session._id.toString(), session.userId.toString()]));

    const results = await Promise.allSettled(devices.map(async device => {
        const { _id, sessionId, userId, registrationToken } = device;
        if (owners.get(sessionId.toString()) !== userId.toString()) return;
        const binding = { _id, sessionId, userId, registrationToken };
        if (!await PushDevice.exists(binding)) return;
        const result = await send(registrationToken, conversation._id.toString(), messageId);
        if (result === 'unregistered') {
            await PushDevice.deleteOne(binding);
        }
        await Message.updateOne({ _id: message._id }, {
            $addToSet: { pushDeliveredTo: _id },
        }, { timestamps: false });
    }));

    const errors = results.filter(result => result.status === 'rejected');
    if (errors.length) {
        const delays = errors.map(({ reason }) => reason instanceof RetryablePushError ? reason.retryAfter : 0);
        throw new RetryablePushError(Math.max(...delays));
    }
}
