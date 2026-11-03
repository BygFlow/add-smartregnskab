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
      style: 'DEFAULT',
      backgroundColor: '#0d0f12',
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
    backgroundColor: '#0d0f12',
  },
  ios: {
    backgroundColor: '#0d0f12',
    // The app handles the notch and home-indicator in CSS via safe-area env().
    contentInset: 'never',
    scrollEnabled: true,
  },
};

export default config;
