import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalpets.app',
  appName: 'My Pets',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F9F4EE',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // Privacy usage descriptions — required by iOS / App Store review
    infoPlist: {
      NSCameraUsageDescription:
        'My Pets uses your camera so you can photograph clothing items to add to your wardrobe.',
      NSPhotoLibraryUsageDescription:
        'My Pets reads your photo library so you can choose existing photos of your clothing items.',
      NSPhotoLibraryAddUsageDescription:
        'My Pets saves photos you take to your library so you can access them later.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
