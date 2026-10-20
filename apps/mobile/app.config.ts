import type { ConfigContext, ExpoConfig } from 'expo/config';
import staticConfig from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? staticConfig.expo.name,
  slug: config.slug ?? staticConfig.expo.slug,
  // SDK57 prefixes exported resources and Router URLs; native builds keep root routes.
  ...(process.env.EXPO_PUBLIC_API_URL === 'same-origin'
    ? { experiments: { ...config.experiments, baseUrl: '/app' } }
    : {}),
});
