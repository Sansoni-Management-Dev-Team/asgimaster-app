// Keep the native auth client out of prototype startup and allow session transport testing.
export const loadNativeAuthClient = () => import('./auth-client');
