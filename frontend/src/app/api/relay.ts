import { NextRequest, NextResponse } from 'next/server';
import { invokeExpress } from './express';
import { enqueueMessagePush } from './messagePush';

const publicPosts = new Set(['auth/login', 'auth/register', 'auth/google']);
const routes = {
  GET: /^(auth\/session|chat\/(users(\/search)?|conversations|(?:messages|summary)\/[a-f0-9]{24}))$/i,
  POST: /^(auth\/(login|register|google|choose-username|logout)|chat\/(conversations|messages|read|smart-replies))$/,
};
const mobilePosts = new Set(['notifications/register', 'notifications/unregister']);
const maxBody = 32 * 1024;
type Method = keyof typeof routes;
export type RelayContext = { params: Promise<{ segments: string[] }> };

const sessionCookie = 'chatsphere_session';
const sessionAge = 7 * 24 * 60 * 60;
const cookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
} as const;
const noStore = { 'Cache-Control': 'no-store' };

function json(data: unknown, status: number) {
  return NextResponse.json(data, { status, headers: noStore });
}

function emptyResponse(clearCookie: boolean) {
  const response = new NextResponse(null, { status: 204, headers: noStore });
  if (clearCookie) response.cookies.set(sessionCookie, '', { ...cookieOptions, maxAge: 0 });
  return response;
}

async function readBody(request: NextRequest) {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxBody);
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return buffer.slice(0, length);
    if (length + value.length > maxBody) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    buffer.set(value, length);
    length += value.length;
  }
}

export async function relay(request: NextRequest, path: string, method: Method, surface: 'web' | 'mobile') {
  const web = surface === 'web';
  if (!routes[method].test(path) && !(surface === 'mobile' && method === 'POST' && mobilePosts.has(path))) {
    return json({ message: 'Route not found' }, 404);
  }
  const origin = process.env.WEB_ORIGIN || request.nextUrl.origin;
  if (web && method === 'POST' && request.headers.get('origin') !== origin) {
    return json({ message: 'Request origin is not allowed' }, 403);
  }
  const isPublic = method === 'POST' && publicPosts.has(path);
  const logout = path === 'auth/logout';
  const token = web ? request.cookies.get(sessionCookie)?.value
    : /^Bearer (\S{1,4096})$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!isPublic && !token) {
    return web && logout ? emptyResponse(true) : json({ message: 'Sign in to continue' }, 401);
  }

  try {
    const body = method === 'POST' ? await readBody(request) : undefined;
    if (body === null) return json({ message: 'Request is too large' }, 413);

    const result = await invokeExpress({
      path: `/api/${path}`,
      method,
      query: request.nextUrl.search.slice(1),
      headers: {
        accept: 'application/json',
        ...(body && { 'content-type': 'application/json' }),
        ...(!isPublic && token && { authorization: `Bearer ${token}` }),
      },
      body,
      sourceIp: process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() : undefined,
    });

    const status = result.statusCode;
    if (status === 204 || (web && logout && status === 401)) return emptyResponse(web && logout);
    const data = JSON.parse(result.body);
    if (isPublic && status >= 200 && status < 300) {
      if (typeof data.token !== 'string' || !data.user) return json({ message: 'Invalid response from the chat service' }, 502);
      if (!web) return json({ user: data.user, token: data.token }, status);
      const response = json({ user: data.user }, status);
      response.cookies.set(sessionCookie, data.token, { ...cookieOptions, maxAge: sessionAge });
      return response;
    }
    if (method === 'POST' && path === 'chat/messages' && (status === 200 || status === 201)) {
      enqueueMessagePush(data._id, data.createdAt);
    }
    const response = json(data, status);
    const retryAfter = result.headers?.['retry-after'];
    if (typeof retryAfter === 'string') response.headers.set('Retry-After', retryAfter);
    return response;
  } catch {
    return json({ message: 'Chat service is unavailable. Try again shortly' }, 503);
  }
}
