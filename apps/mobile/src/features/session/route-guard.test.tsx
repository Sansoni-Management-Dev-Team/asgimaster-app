import { expect, it } from '@jest/globals';
import { routeDecision } from './route-guard';
it('waits for session and profile hydration before routing any deep link', () => {
  for (const route of ['home', 'onboarding', 'offboarding', 'auth-callback', 'sign-in'])
    expect(routeDecision('loading', route)).toBe('loading');
});
it('protects direct member and demo links while signed out', () => {
  for (const route of ['home', 'onboarding', 'offboarding'])
    expect(routeDecision('signed-out', route)).toBe('sign-in');
  expect(routeDecision('signed-out', 'auth-callback')).toBe('allow');
});
it('opens Home for a member independently of onboarding and disallows prototype routes', () => {
  expect(routeDecision('ready', 'index')).toBe('home');
  expect(routeDecision('ready', 'offboarding')).toBe('home');
  expect(routeDecision('ready', 'home')).toBe('allow');
  expect(routeDecision('ready', 'onboarding')).toBe('allow');
  expect(routeDecision('error', 'home')).toBe('error');
});
it('does not let a covered member screen redirect a foreground sign-in callback during account switching', () => {
  expect(routeDecision('signed-out', 'home', false)).toBe('hidden');
  expect(routeDecision('loading', 'onboarding', false)).toBe('hidden');
  expect(routeDecision('signed-out', 'auth-callback', true)).toBe('allow');
});
