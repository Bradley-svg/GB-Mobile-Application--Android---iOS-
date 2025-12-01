import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // EXPO_PUBLIC_API_URL is baked into the bundle and exposed via Constants.expoConfig.extra.apiUrl
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';

  return {
    ...config,
    name: 'greenbro-mobile',
    slug: 'greenbro-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
    },
    extra: {
      ...(config.extra || {}),
      apiUrl,
    },
  };
};
