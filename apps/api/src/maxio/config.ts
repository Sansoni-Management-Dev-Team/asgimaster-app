import type { MaxioSiteConfig } from './adapter.js';

// Only API-side environment variables. No product, identity or access mapping is assumed.
export function loadMaxioSites(
  env: NodeJS.ProcessEnv = process.env,
): Record<'AU' | 'NZ', MaxioSiteConfig> {
  return {
    AU: { subdomain: env.MAXIO_AU_SUBDOMAIN, apiKey: env.MAXIO_AU_API_KEY },
    NZ: { subdomain: env.MAXIO_NZ_SUBDOMAIN, apiKey: env.MAXIO_NZ_API_KEY },
  };
}
