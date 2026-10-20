const configuredURL = process.env.EXPO_PUBLIC_API_URL;

// A configured build always uses the server. Demo stores are mounted only in prototype mode.
export const backendConfigured = configuredURL !== undefined;
export const apiURL = configuredURL?.trim().replace(/\/+$/, '') ?? '';
export function validateAPIURL(value: string) {
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  )
    throw new Error('Set EXPO_PUBLIC_API_URL to the API origin.');
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname) &&
    !__DEV__
  )
    throw new Error('Member sign-in requires an HTTPS API URL.');
  return value;
}
