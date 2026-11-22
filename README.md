# ChatSphere

ChatSphere is a one-to-one messaging app. The web client uses Next.js and Redux Toolkit. The Express API uses MongoDB for accounts, conversations, and messages, Socket.IO for live delivery, and Gemini for reply suggestions and thread summaries.

## Web preview

Use Node.js 22 and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open [the web app](http://localhost:3000) and select **Open demo inbox**. The sample inbox runs without an API or database. It uses synthetic conversations and resets on reload.

## Run against the Express API

1. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=http://localhost:3000`, and `PORT=6001` in `backend/.env`. Set `GEMINI_API_KEY` for live reply suggestions and summaries.
2. Copy `frontend/.env.example` to `frontend/.env.local`. Set `NEXT_PUBLIC_API_URL` if the API runs somewhere other than `http://localhost:6001`. To show Google sign-in, set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to a Google OAuth web client ID that allows your frontend origin.
3. Build and start the API in a separate terminal.

   ```sh
   cd backend
   npm ci
   npm run build
   npm start
   ```

Complete the planned authentication and chat authorization changes before hosting the API.

## Web checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` from `frontend/`. See [DESIGN.md](DESIGN.md) for the web design shared with the planned Android client and [ARCHITECTURE.md](ARCHITECTURE.md) for the original backend diagrams.
