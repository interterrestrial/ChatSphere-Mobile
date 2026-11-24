# ChatSphere architecture

Next.js and Express share one Vercel project. The Next.js Node.js API route authenticates the browser session and dispatches allowlisted requests to Express in the same function. It never forwards session tokens to browser JavaScript. MongoDB connection pools are reused within warm functions.

| Surface | Session | Message synchronization |
| --- | --- | --- |
| Vercel web | Secure HttpOnly cookie and revocable MongoDB session | Authenticated cursor polling with visibility-aware backoff |
| Standalone API for the future native release | Bearer session | Socket.IO tickets and private rooms |

The same-origin web API rejects cross-origin writes and marks session responses as uncacheable. Express verifies Google ID-token audiences and revokes server sessions on logout. Sign-in, registration, and Gemini limits share MongoDB counters. The API bounds each request body and message page.

## Conversations and messages

- Conversation membership gates history, sending, and both AI endpoints. Concurrent starts use a unique direct-conversation key.
- Message writes use a client message ID scoped to the sender and conversation. The API reuses the saved message on retry, and clients merge by server message ID.
- Message history returns up to 50 chronologically ordered messages. Backward cursors load earlier history. Forward cursors recover messages missed while the client was hidden or offline.
- Gemini receives the selected incoming message or a bounded recent transcript when a participant requests help. Gemini configuration is optional.

## Deployment boundaries

The Vercel health route is `/api/health`. It checks the database connection and index initialization. Vercel messaging uses HTTPS polling because Vercel Functions do not run the standalone Socket.IO server.

The native release and Firebase delivery remain separate work. The standalone API can still run with `npm start --prefix backend` for that phase.
