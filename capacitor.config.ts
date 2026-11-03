import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.smartregnskab.app',
  appName: 'ADD SmartRegnskab',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    // Capacitor's supported local iOS scheme. API calls still use the explicit
    // HTTPS production base configured in client/src/lib/queryClient.ts.
    iosScheme: 'capacitor',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#047857',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#047857',
    },
    Keyboard: {
      resize: 'native',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
  ios: {
    backgroundColor: '#ffffff',
    contentInset: 'always',
    scrollEnabled: true,
  },
};

export default config;
