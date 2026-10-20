import { expect, it } from '@jest/globals';
import { validateAPIURL, resolveAPIURL } from './api-config';
it('accepts an API origin and rejects malformed or credential-bearing configured URLs', () => {
  expect(validateAPIURL('https://members.example.test')).toBe('https://members.example.test');
  expect(validateAPIURL('http://localhost:3000')).toBe('http://localhost:3000');
  for (const value of [
    'not-a-url',
    'https://members.example.test/v1',
    'https://user:password@members.example.test',
    'https://members.example.test?mode=demo',
    'file:///tmp/api',
  ])
    expect(() => validateAPIURL(value)).toThrow();
});
it('resolves explicit same-origin browser mode without inheriting a native API URL', () => {
  expect(resolveAPIURL('same-origin', 'web', 'https://review.example.test')).toBe(
    'https://review.example.test',
  );
  expect(() => resolveAPIURL('same-origin', 'ios', 'https://review.example.test')).toThrow(
    'requires a browser',
  );
  expect(() => resolveAPIURL('same-origin', 'web')).toThrow('unavailable');
  expect(resolveAPIURL('https://native.example.test', 'ios')).toBe('https://native.example.test');
});
