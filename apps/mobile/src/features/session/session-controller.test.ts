import { expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import {
  createSessionController,
  memberKey,
  PROFILE_CACHE_MAX_AGE_MS,
  type Credentials,
} from './session-controller';
import { memberAPI, responseJSON } from './api';

const origin = 'https://members.example.test';
const sessionBody = () => ({
  user: { id: 'auth-a' },
  session: { expiresAt: new Date(Date.now() + 3 * PROFILE_CACHE_MAX_AGE_MS).toISOString() },
});
const member = (id = 'member-a') => ({
  member: { id, displayName: id, email: `${id}@example.test` },
  access: {
    state: 'none',
    planLabel: null,
    capabilities: [],
    sourceAsAt: null,
    rulesVersion: null,
    hash: null,
  },
  onboarding: { version: 1, answers: {} },
});
const json = (body: unknown, status = 200, token?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'set-auth-token': token } : {}) },
  });
function fixture(initial: Credentials | null = { token: 'saved-token', memberId: 'member-a' }) {
  let saved = initial;
  const entries = new Map<string, string>();
  const storage = {
    get: jest.fn(async () => saved),
    set: jest.fn(async (_key: string, value: Credentials) => {
      saved = value;
    }),
    remove: jest.fn(async () => {
      saved = null;
    }),
  };
  const cache = {
    getItem: jest.fn(async (key: string) => entries.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      entries.delete(key);
    }),
  };
  const fetcher = jest.fn<typeof fetch>();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const session = createSessionController({ origin, storage, cache, fetcher, queryClient });
  const ready = async () => {
    fetcher
      .mockResolvedValueOnce(json(sessionBody(), 200, 'renewed-token'))
      .mockResolvedValueOnce(json(member()));
    await session.hydrate();
  };
  return { session, storage, cache, fetcher, queryClient, entries, ready, saved: () => saved };
}

it('finishes secure token hydration and server member hydration before opening the gate', async () => {
  const f = fixture();
  let release!: (value: Response) => void;
  f.fetcher
    .mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    )
    .mockResolvedValueOnce(json(member()));
  const pending = f.session.hydrate();
  expect(f.session.store.getState().status).toBe('loading');
  await Promise.resolve();
  release(json(sessionBody(), 200, 'renewed'));
  await pending;
  expect(f.saved()).toMatchObject({ token: 'renewed', memberId: 'member-a' });
  expect(f.session.store.getState()).toMatchObject({ status: 'ready', memberId: 'member-a' });
  expect(f.fetcher.mock.calls[1][1]?.credentials).toBe('omit');
  expect(new Headers(f.fetcher.mock.calls[1][1]?.headers).get('Authorization')).toBe(
    'Bearer renewed',
  );
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toEqual(member());
});
it('never hydrates a revoked session from its persisted member snapshot', async () => {
  const f = fixture();
  await f.ready();
  f.fetcher.mockResolvedValueOnce(
    json({ error: { code: 'UNAUTHORIZED', message: 'expired' } }, 401),
  );
  await f.session.hydrate();
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.entries.size).toBe(0);
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(f.saved()).toBeNull();
});
it('treats a null Better Auth session as expired and clears named data', async () => {
  const f = fixture();
  await f.ready();
  f.fetcher.mockResolvedValueOnce(json(null));
  await f.session.hydrate();
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.entries.size).toBe(0);
});
it('keeps a failed server sign-out retryable and only clears data after revocation succeeds', async () => {
  const f = fixture();
  await f.ready();
  f.fetcher.mockRejectedValueOnce(new Error('offline'));
  await expect(f.session.signOut()).rejects.toThrow('Cannot reach');
  expect(f.session.store.getState().status).toBe('ready');
  expect(f.saved()?.token).toBe('renewed-token');
  expect(f.entries.size).toBe(1);
  f.fetcher.mockResolvedValueOnce(json({ success: true }));
  await f.session.signOut();
  expect(f.saved()).toBeNull();
  expect(f.entries.size).toBe(0);
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
});
it('removes the previous member before accepting a second account', async () => {
  const f = fixture();
  await f.ready();
  await f.session.beginSignIn();
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toBeUndefined();
  expect(f.entries.size).toBe(0);
  f.fetcher
    .mockResolvedValueOnce(json({}, 200, 'token-b'))
    .mockResolvedValueOnce(json(sessionBody()))
    .mockResolvedValueOnce(json(member('member-b')));
  await f.session.request('/v1/auth/sign-in/email-otp', { method: 'POST' });
  await f.session.finishSignIn();
  expect(f.session.store.getState().memberId).toBe('member-b');
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toBeUndefined();
  expect([...f.entries.values()][0]).toContain('member-b');
});
it('ignores a late member response after sign-out', async () => {
  const f = fixture();
  await f.ready();
  let release!: (value: Response) => void;
  f.fetcher.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const late = f.session.refreshMember();
  f.fetcher.mockResolvedValueOnce(json({ success: true }));
  await f.session.signOut();
  release(json(member(), 200, 'late-token'));
  await expect(late).rejects.toThrow('session changed');
  expect(f.saved()).toBeNull();
  expect(f.entries.size).toBe(0);
});
it('ignores an onboarding response from the previous member', async () => {
  const f = fixture();
  await f.ready();
  let release!: (value: Response) => void;
  f.fetcher.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const late = f.session.saveOnboarding(
    { version: 1, answers: { industry: 'Technology' } },
    'one-write',
  );
  await f.session.beginSignIn();
  release(json({ version: 1, answers: { industry: 'Technology' } }));
  await expect(late).rejects.toThrow('session changed');
  expect(f.entries.size).toBe(0);
});
it('keeps the last confirmed onboarding record after failed write and sends the same idempotency key on retry', async () => {
  const f = fixture();
  await f.ready();
  const draft = { version: 1 as const, answers: { industry: 'Technology' } };
  f.fetcher.mockResolvedValueOnce(
    json({ error: { code: 'UNAVAILABLE', message: 'Try again' } }, 503),
  );
  await expect(f.session.saveOnboarding(draft, 'retry-key')).rejects.toThrow('Please try again');
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toEqual(member());
  f.fetcher.mockResolvedValueOnce(json(draft));
  await f.session.saveOnboarding(draft, 'retry-key');
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toMatchObject({
    onboarding: draft,
  });
  expect(
    f.fetcher.mock.calls
      .slice(-2)
      .map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')),
  ).toEqual(['retry-key', 'retry-key']);
});
it('validates successful API responses and reports structured errors', async () => {
  const api = memberAPI(async () => json({ member: { id: 'untrusted' } }));
  await expect(api.me()).rejects.toThrow();
  await expect(
    responseJSON(
      json({ error: { code: 'MEMBER_NOT_LINKED', message: 'Member access is not linked.' } }, 403),
    ),
  ).rejects.toMatchObject({ status: 403, code: 'MEMBER_NOT_LINKED' });
});
it('never accepts a session if SecureStore cannot persist the issued token', async () => {
  const f = fixture(null);
  f.storage.set.mockRejectedValueOnce(new Error('secure storage unavailable'));
  f.fetcher.mockResolvedValueOnce(json({}, 200, 'issued-token'));
  await expect(f.session.request('/v1/auth/sign-in/email-otp')).rejects.toThrow(
    'secure storage unavailable',
  );
  await expect(f.session.finishSignIn()).rejects.toThrow('native session');
});
it('only uses last-known-good data for the same previously authenticated member on network failure', async () => {
  const f = fixture();
  await f.ready();
  f.fetcher.mockResolvedValueOnce(json(sessionBody())).mockRejectedValueOnce(new Error('offline'));
  await f.session.hydrate();
  expect(f.session.store.getState()).toMatchObject({ status: 'ready', memberId: 'member-a' });
  expect(f.session.store.getState().error).toBe('');
});
it('restores only a bounded named profile when every request fails on a real cold start', async () => {
  const f = fixture();
  await f.ready();
  const fetcher = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const cold = createSessionController({
    origin,
    storage: f.storage,
    cache: f.cache,
    fetcher,
    queryClient,
  });
  await cold.hydrate();
  expect(cold.store.getState()).toEqual({ status: 'ready', memberId: 'member-a', error: '' });
  expect(queryClient.getQueryData(memberKey(origin, 'member-a'))).toEqual(member());
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retains saved work but refuses to open an expired profile cache or expired server session offline', async () => {
  const f = fixture();
  await f.ready();
  for (const offset of [PROFILE_CACHE_MAX_AGE_MS + 1, 4 * PROFILE_CACHE_MAX_AGE_MS]) {
    const cold = createSessionController({
      origin,
      storage: f.storage,
      cache: f.cache,
      fetcher: jest.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      queryClient: new QueryClient(),
      now: () => Date.now() + offset,
    });
    await cold.hydrate();
    expect(cold.store.getState().status).toBe('error');
    expect(f.entries.size).toBe(1);
  }
});
it('clears visible data on server signout even if secure credential deletion fails, then retries local cleanup', async () => {
  const f = fixture();
  await f.ready();
  f.storage.remove.mockRejectedValueOnce(new Error('disk unavailable'));
  f.fetcher.mockResolvedValueOnce(json({ success: true }));
  await f.session.signOut();
  expect(f.session.store.getState()).toMatchObject({ status: 'signed-out', memberId: undefined });
  expect(f.session.store.getState().error).toContain('server session has ended');
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(f.entries.size).toBe(0);
  await f.session.retryLocalCleanup();
  expect(f.saved()).toBeNull();
  expect(f.session.store.getState().error).toBe('');
});
it('clears visible data on 401 even if credential deletion fails', async () => {
  const f = fixture();
  await f.ready();
  f.storage.remove.mockRejectedValueOnce(new Error('disk unavailable'));
  f.fetcher.mockResolvedValueOnce(json({ error: { code: 'UNAUTHORIZED' } }, 401));
  await f.session.hydrate();
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.entries.size).toBe(0);
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
});
it('does not restore a delayed SecureStore read after a member switch', async () => {
  const f = fixture();
  let release!: (value: Credentials | null) => void;
  f.storage.get.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = f.session.hydrate();
  await f.session.beginSignIn();
  release({ token: 'old-token', memberId: 'member-a' });
  await pending;
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.saved()).toBeNull();
  expect(f.fetcher).not.toHaveBeenCalled();
});
it('does not restore a delayed cached snapshot after local cleanup', async () => {
  const f = fixture();
  await f.ready();
  const snapshot = [...f.entries.values()][0];
  let release!: (value: string | null) => void;
  f.cache.getItem.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  f.fetcher.mockRejectedValueOnce(new Error('offline'));
  const pending = f.session.hydrate();
  // Reach the cache read before switching sessions.
  while (!f.cache.getItem.mock.calls.length) await Promise.resolve();
  await f.session.beginSignIn();
  release(snapshot);
  await pending;
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
});
it('does not publish the previous member after a delayed credential write', async () => {
  const f = fixture();
  let release!: () => void;
  f.fetcher.mockResolvedValueOnce(json(sessionBody())).mockResolvedValueOnce(json(member()));
  const realSet = f.storage.set.getMockImplementation()!;
  f.storage.set.mockImplementationOnce(realSet).mockImplementationOnce(async (key, value) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await realSet(key, value);
  });
  const pending = f.session.hydrate();
  while (!release) await Promise.resolve();
  const switching = f.session.beginSignIn();
  release();
  await Promise.all([pending, switching]);
  expect(f.session.store.getState().status).toBe('signed-out');
  expect(f.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(f.saved()).toBeNull();
});
it('reports a recoverable hydration error when the named snapshot cannot be read offline', async () => {
  const f = fixture();
  await f.ready();
  f.cache.getItem.mockRejectedValueOnce(new Error('disk unavailable'));
  f.fetcher.mockRejectedValueOnce(new Error('offline'));
  await expect(f.session.hydrate()).resolves.toBeUndefined();
  expect(f.session.store.getState().status).toBe('error');
});
it('keeps the ready screen mounted while foreground validation is pending so UI drafts survive', async () => {
  const f = fixture();
  await f.ready();
  let release!: (value: Response) => void;
  f.fetcher
    .mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    )
    .mockResolvedValueOnce(json(member()));
  const pending = f.session.hydrate({ background: true });
  expect(f.session.store.getState().status).toBe('ready');
  await Promise.resolve();
  release(json(sessionBody()));
  await pending;
  expect(f.session.store.getState().status).toBe('ready');
});
it('declares the fixed approved native origin while omitting cookie credentials', async () => {
  const f = fixture();
  await f.ready();
  expect(new Headers(f.fetcher.mock.calls[0][1]?.headers).get('Origin')).toBe('mlaisansoni://');
  expect(f.fetcher.mock.calls[0][1]?.credentials).toBe('omit');
});
it('does not overwrite a confirmed onboarding save with an earlier delayed profile read', async () => {
  const f = fixture();
  await f.ready();
  let release!: (value: Response) => void;
  f.fetcher.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const refresh = f.session.refreshMember();
  const saved = { version: 1 as const, answers: { industry: 'Space travel' } };
  f.fetcher.mockResolvedValueOnce(json(saved));
  await f.session.saveOnboarding(saved, 'concurrent-save');
  release(json(member()));
  expect(await refresh).toMatchObject({ onboarding: saved });
  expect(f.queryClient.getQueryData(memberKey(origin, 'member-a'))).toMatchObject({
    onboarding: saved,
  });
});
