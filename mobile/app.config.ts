import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';
const BRAND_BACKGROUND = '#FFFFFF';
const ICON_PATH = './assets/greenbro/greenbro-icon-1024.png';
const SPLASH_PATH = './assets/greenbro/greenbro-splash.png';

export default ({ config }: ConfigContext): ExpoConfig => {
  // EXPO_PUBLIC_API_URL is baked into the bundle and exposed via Constants.expoConfig.extra.apiUrl
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';
  const useSignedFileUrls = process.env.EXPO_PUBLIC_USE_SIGNED_FILE_URLS === 'true';

  return {
    ...config,
    name: 'greenbro-mobile',
    slug: 'greenbro-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: ICON_PATH,
    userInterfaceStyle: 'light',
    splash: {
      image: SPLASH_PATH,
      resizeMode: 'contain',
      backgroundColor: BRAND_BACKGROUND,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      ...(config.ios || {}),
      supportsTablet: true,
      icon: ICON_PATH,
    },
    android: {
      ...(config.android || {}),
      // Unique application id required for native builds/dev client
      package: 'com.greenbro.mobile',
      adaptiveIcon: {
        foregroundImage: ICON_PATH,
        backgroundColor: BRAND_BACKGROUND,
      },
    },
    web: {
      bundler: 'metro',
    },
    extra: {
      ...(config.extra || {}),
      apiUrl,
      useSignedFileUrls,
    },
  };
};
