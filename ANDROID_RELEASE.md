# Release ChatSphere for Android

Both APKs connect to the same Vercel deployment and MongoDB database as the web app. The Android package is `com.deepak.chatsphere`.

## Signed test APK

1. Deploy the updated repository to the existing Vercel project. Keep the existing database, session signing key, and Google OAuth settings. Leave `PUSH_NOTIFICATIONS_ENABLED` unset or set it to `false`. Check `/api/health` after deployment.
2. In Expo, link the project from `mobile/` with `npx eas-cli@latest init`. In its **production** environment set `EXPO_PUBLIC_API_URL` to the Vercel origin without an API path, and set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the existing web OAuth client ID. These values are public.
3. Run `npx eas-cli@latest credentials --platform android` from `mobile/`. Select `release-check`, set up the Android signing keystore, and record its SHA-1 fingerprint. In the same Google Cloud project as the web OAuth client, create an **Android** OAuth client with the package name and this release SHA-1. The mobile app still uses the web ID for its backend token audience.
4. Run `npx eas-cli@latest build --platform android --profile release-check` from `mobile/`. Install the APK on a phone and check email and Google sign-in, session restore, sign-out, messaging both ways with the web app, and unread dots. Leave push disabled for this test.

## Configure Firebase and build the final APK

1. Register the same Android package in Firebase. Download its `google-services.json`. Upload it to the Expo **production** environment as a file variable named `GOOGLE_SERVICES_JSON`, or use `mobile/google-services.json` for local native builds. The APK uses this app configuration to obtain an FCM registration token.
2. Enable the Firebase Cloud Messaging API. Give a Firebase service account permission to send FCM messages in that project. In Vercel **Production**, set `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY` from the service account configuration. Store the private key as a sensitive environment variable. Keep the service-account JSON and signing key out of source control.
3. Set `PUSH_NOTIFICATIONS_ENABLED=true` in Vercel and redeploy. The repo configures the Vercel Queue subscriber. Check Vercel logs for queue or FCM failures while verifying the first push.
4. Run `npx eas-cli@latest build --platform android --profile release-apk` from `mobile/`. Reuse the test APK signing keystore. This profile increments the Android version code and supports installing over the test APK.

Verify an upgrade and a clean install on a Google Play Services-capable device. Test notification permission, foreground behavior, alerts from web and Android when the recipient app is backgrounded or normally closed, notification taps on a cold start, and sign-out or account switching. The notification text is generic. Use `PUSH_NOTIFICATIONS_ENABLED=false` and redeploy if you need to stop sending while keeping chat available.

Before sharing the final APK, rotate the previously shared Atlas credential. Update `MONGO_URI` in Vercel, verify the health endpoint and messaging, then revoke the old credential.
