import { JWT } from 'google-auth-library';

let client: JWT | undefined;

export function pushEnabled() {
    return process.env.PUSH_NOTIFICATIONS_ENABLED === 'true';
}

export class RetryablePushError extends Error {
    constructor(readonly retryAfter = 0) {
        super('Push delivery is temporarily unavailable');
    }
}

function retryDelay(header: string | null) {
    if (!header) return 0;
    const seconds = /^\d+$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
    return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export async function sendFirebasePush(registrationToken: string, conversationId: string, messageId: string) {
    const projectId = process.env.FCM_PROJECT_ID;
    const email = process.env.FCM_CLIENT_EMAIL;
    const key = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !email || !key) {
        console.error('FCM delivery is enabled without its server credentials');
        return 'rejected';
    }
    client ??= new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });

    let response: Response;
    try {
        const { token } = await client.getAccessToken();
        if (!token) throw new RetryablePushError();
        response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    token: registrationToken,
                    notification: { title: 'ChatSphere', body: 'New message' },
                    data: { conversationId, messageId },
                    android: {
                        priority: 'HIGH', ttl: '900s',
                        notification: { channel_id: 'messages', tag: `conversation-${conversationId}`, visibility: 'PRIVATE' },
                    },
                },
            }),
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        throw new RetryablePushError();
    }
    if (response.ok) return 'sent';
    if (response.status === 429 || response.status >= 500) {
        throw new RetryablePushError(Math.max(response.status === 429 ? 60 : 0, retryDelay(response.headers.get('retry-after'))));
    }
    const data = await response.json().catch(() => undefined) as { error?: { details?: unknown[] } } | undefined;
    const details = data?.error?.details;
    if (Array.isArray(details) && details.some(detail =>
        detail && typeof detail === 'object' && 'errorCode' in detail && detail.errorCode === 'UNREGISTERED')) {
        return 'unregistered';
    }
    console.error('FCM rejected a push notification', { status: response.status });
    return 'rejected';
}
