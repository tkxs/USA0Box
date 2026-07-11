import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'com.tkxs.sub0box',
  appName: 'Sub0Box',
  webDir: 'release/app/dist/renderer',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      resize: KeyboardResize.Native,
    },
  },
}

export default config
