import { handleCallback } from '@vercel/queue';
import { deliverMessagePush } from '@backend/utils/deliverMessagePush';
import { pushEnabled, RetryablePushError } from '@backend/utils/firebasePush';
import { ensureDatabase } from '../../express';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = handleCallback<{ messageId?: unknown }>(async (payload) => {
  if (!pushEnabled() || typeof payload?.messageId !== 'string' || !/^[a-f0-9]{24}$/.test(payload.messageId)) return;
  await ensureDatabase();
  await deliverMessagePush(payload.messageId);
}, {
  retry: (error, { deliveryCount }) => {
    if (deliveryCount >= 5) {
      console.error('Chat push delivery exhausted its retries');
      return { acknowledge: true };
    }
    const retryAfter = error instanceof RetryablePushError ? error.retryAfter : 0;
    return { afterSeconds: Math.max(retryAfter, Math.min(60, 10 * 2 ** (deliveryCount - 1))) };
  },
});
