import { NextRequest } from 'next/server';
import { relay, type RelayContext } from '../../relay';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: RelayContext) {
  return relay(request, (await params).segments.join('/'), 'GET', 'web');
}

export async function POST(request: NextRequest, { params }: RelayContext) {
  return relay(request, (await params).segments.join('/'), 'POST', 'web');
}
