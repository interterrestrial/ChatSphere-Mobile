import type { ExpoConfig } from 'expo/config';

const allowLocalHttp = process.env.CHATSPHERE_ALLOW_HTTP === 'true';
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const url = URL.parse(process.env.EXPO_PUBLIC_API_URL || '');
  if (!url || url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash || allowLocalHttp) {
    throw new Error('The production Android build needs an HTTPS API origin and Android cleartext disabled.');
  }
}

const config: ExpoConfig = {
  name: 'ChatSphere',
  slug: 'chatsphere-mobile',
  scheme: 'chatsphere',
  version: '1.0.0',
  platforms: ['android'],
  icon: './assets/icon.png',
  android: {
    package: 'com.deepak.chatsphere',
    versionCode: 1,
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
  ],
};

export default config;
