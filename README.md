# ChatSphere

ChatSphere is a one-to-one messaging web app. Next.js serves the UI and runs the Express API in Vercel Node.js Functions. MongoDB stores accounts, sessions, conversations, and messages.

## Run the web app

Use Node.js 22.13 or later within the Node.js 22 release line. Install both packages from the repository root.

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm run dev --prefix frontend
```

Set the values from `frontend/.env.example` in `frontend/.env.local` before starting. Use a local or dedicated development MongoDB database for manual testing. Open [ChatSphere](http://localhost:3000).

## Deploy the web app on Vercel

Set the project framework to Next.js and its root directory to `frontend`. Include files outside the project root so the Next.js build can trace the sibling Express package. Use Node.js 22. The install command in `frontend/vercel.json` installs both lockfiles from the repository. Deploy from the repository root when using Vercel CLI.

- Set `MONGO_URI` to the application database and `JWT_SECRET` to a generated secret with at least 32 bytes. Store both as sensitive production environment variables. The API initializes collections and indexes when it first connects.
- Set `GOOGLE_CLIENT_IDS` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the web OAuth client ID. Add the exact production URL to **Authorized JavaScript origins** for that client in Google Cloud.
- Optionally set `GEMINI_API_KEY` and `GEMINI_MODEL` together to enable assistance on request. Core messaging works with Gemini disabled.
- Use `/api/health` to check database readiness. Verify Google sign-in and message delivery with two real accounts during release acceptance.

Vercel web sessions use HTTP-only cookies. Open inboxes sync over authenticated HTTPS approximately every five seconds. Hidden tabs pause synchronization and resume when visible.

## Verification

- **Backend** — Run `npm run build --prefix backend`. For the integration suite, point `TEST_MONGO_URI` to a disposable loopback MongoDB process before running `npm test --prefix backend`. The suite drops only the temporary database it creates.
- **Web** — Run `npm run lint --prefix frontend`, `npm run build --prefix frontend`, and `npm run typecheck --prefix frontend`.
- **Android** — Run `npm run typecheck --prefix mobile` and `npm run bundle:android --prefix mobile`. The bundle check verifies the JavaScript build. Follow the [Android release steps](ANDROID_RELEASE.md) for signed APKs and Firebase.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the request and synchronization flow.
