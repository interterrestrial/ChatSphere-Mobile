import { invokeExpress } from '../express';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const result = await invokeExpress({ path: '/health/ready', method: 'GET', query: '', headers: {} });
    return Response.json({ status: result.statusCode === 200 ? 'ready' : 'unavailable' }, {
      status: result.statusCode === 200 ? 200 : 503, headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Database readiness check failed', { name: error instanceof Error ? error.name : 'Unknown' });
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
