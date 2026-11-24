import type { ExpoConfig } from 'expo/config';

const allowLocalHttp = process.env.CHATSPHERE_ALLOW_HTTP === 'true';
const buildProfile = process.env.EAS_BUILD_PROFILE;
const release = ['release-check', 'release-apk', 'production'].includes(buildProfile ?? '');
const pushEnabled = process.env.EXPO_PUBLIC_ENABLE_PUSH === 'true';
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';

if (release) {
  const url = URL.parse(process.env.EXPO_PUBLIC_API_URL || '');
  if (!url || url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash || allowLocalHttp) {
    throw new Error('The signed Android build needs an HTTPS API origin and Android cleartext disabled.');
  }
  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim().endsWith('.apps.googleusercontent.com')) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for Android release sign-in.');
  }
}

const config: ExpoConfig = {
  name: 'ChatSphere',
  slug: 'chatsphere-mobile',
  owner: 'deepakmishra16',
  extra: {
    eas: { projectId: '17c42fad-0a83-421c-b4d9-5d8aebf02bac' },
  },
  scheme: 'chatsphere',
  version: '1.0.0',
  platforms: ['android'],
  icon: './assets/icon.png',
  android: {
    package: 'com.deepak.chatsphere',
    versionCode: buildProfile === 'release-check' ? 1 : 2,
    ...(pushEnabled && { googleServicesFile }),
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: true,
    adaptiveIcon: {
      backgroundColor: '#2947c6',
      foregroundImage: './assets/adaptive-icon.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    '@react-native-google-signin/google-signin',
    ['expo-build-properties', { android: { usesCleartextTraffic: allowLocalHttp } }],
    ...(pushEnabled ? [['expo-notifications', { defaultChannel: 'messages' }] as [string, { defaultChannel: string }]] : []),
  ],
};

export default config;
