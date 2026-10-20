import type { SessionState } from './session-controller';
function destination(status: SessionState['status'], route: string) {
  if (status === 'loading') return 'loading';
  if (route === 'auth-callback') return 'allow';
  if (status === 'error') return route === 'sign-in' ? 'allow' : 'error';
  if (status === 'signed-out') return route === 'sign-in' ? 'allow' : 'sign-in';
  return ['home', 'onboarding'].includes(route) ? 'allow' : 'home';
}
export function routeDecision(status: SessionState['status'], route: string, focused = true) {
  const decision = destination(status, route);
  // A covered screen must never redirect an in-progress magic-link callback or a newer route.
  return focused || decision === 'allow' ? decision : 'hidden';
}
