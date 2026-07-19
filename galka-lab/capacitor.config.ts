import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.galka.lab',
  appName: 'Galka Lab',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
