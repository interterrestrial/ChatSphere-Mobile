import { isIP } from 'node:net';
import serverless from 'serverless-http';
import { createApp } from '@backend/app';
import { jwtSecret, mongoUri, readConfig } from '@backend/config';
import { connectDB } from '@backend/db/db';

let database: Promise<void> | undefined;
const handler = serverless(createApp(readConfig()));

export function ensureDatabase() {
  if (!database) {
    jwtSecret();
    database = connectDB(mongoUri(), 5).catch(error => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

export async function invokeExpress({
  path, method, query, headers, body, sourceIp,
}: {
  path: string;
  method: 'GET' | 'POST';
  query: string;
  headers: Record<string, string>;
  body?: Uint8Array;
  sourceIp?: string;
}) {
  await ensureDatabase();
  const response: unknown = await handler({
    version: '2.0',
    rawPath: path,
    rawQueryString: query,
    headers,
    requestContext: {
      http: { method, path, sourceIp: sourceIp && isIP(sourceIp) ? sourceIp : '127.0.0.1' },
    },
    ...(body && { body: Buffer.from(body).toString('utf8') }),
  }, {});
  if (typeof response !== 'object' || !response || !('statusCode' in response) || typeof response.statusCode !== 'number'
    || !('body' in response) || typeof response.body !== 'string') {
    throw new Error('Unexpected Express response');
  }
  const responseHeaders = 'headers' in response && typeof response.headers === 'object' && response.headers
    ? response.headers as Record<string, unknown> : {};
  return { statusCode: response.statusCode, body: response.body, headers: responseHeaders };
}
