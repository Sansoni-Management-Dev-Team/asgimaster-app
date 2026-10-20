import { expect, it } from '@jest/globals';
import { validateAPIURL } from './api-config';
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
