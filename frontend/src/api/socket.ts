import { io } from 'socket.io-client';
import { API_HOST, readToken } from '.';

export function connectChat(userId: string) {
  return io(API_HOST, {
    autoConnect: false,
    query: { userId },
    auth: { token: readToken() },
  });
}
