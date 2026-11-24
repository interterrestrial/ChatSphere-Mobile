import { send } from '@vercel/queue';
import { after } from 'next/server';
import { pushLifetimeSeconds, pushMessageTopic } from '@backend/utils/deliverMessagePush';
import { pushEnabled } from '@backend/utils/firebasePush';

export function enqueueMessagePush(messageId: unknown, createdAt: unknown) {
  if (!pushEnabled() || typeof messageId !== 'string' || !/^[a-f0-9]{24}$/.test(messageId) ||
    typeof createdAt !== 'string' || Date.now() - Date.parse(createdAt) >= pushLifetimeSeconds * 1000) return;
  after(async () => {
    const options = { idempotencyKey: messageId, retentionSeconds: pushLifetimeSeconds };
    try {
      await send(pushMessageTopic, { messageId }, options);
    } catch {
      try {
        await send(pushMessageTopic, { messageId }, options);
      } catch {
        console.error('Could not enqueue a chat notification', { messageId });
      }
    }
  });
}
