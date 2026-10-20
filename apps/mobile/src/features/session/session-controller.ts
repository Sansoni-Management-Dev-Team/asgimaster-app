import { QueryClient } from '@tanstack/react-query';
import { MeResponseSchema, type MeResponse } from '@mlai-sansoni/contracts';
import { createStore } from 'zustand/vanilla';
import { ApiError, memberAPI, responseJSON } from './api';

export type Credentials = { token: string; memberId?: string; expiresAt?: number };
// Profile readability only; this cache never grants capabilities or authorises writes.
export const PROFILE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
type Storage = {
  get(key: string): Promise<Credentials | null>;
  set(key: string, value: Credentials): Promise<void>;
  remove(key: string): Promise<void>;
};
type Cache = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type SessionState = {
  status: 'loading' | 'signed-out' | 'ready' | 'error';
  memberId?: string;
  error: string;
};
export const memberKey = (origin: string, id: string) => ['member', origin, id, 'me'] as const;
const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Your member session could not be restored. Try again or sign in again.';

export function createSessionController({
  origin,
  queryClient,
  storage,
  cache,
  fetcher = fetch,
  now = Date.now,
  profileCacheMaxAge = PROFILE_CACHE_MAX_AGE_MS,
  nativeOrigin = 'mlaisansoni://',
}: {
  origin: string;
  queryClient: QueryClient;
  storage: Storage;
  cache: Cache;
  fetcher?: typeof fetch;
  now?: () => number;
  profileCacheMaxAge?: number;
  nativeOrigin?: string | null;
}) {
  const store = createStore<SessionState>(() => ({ status: 'loading', error: '' }));
  // The API origin is part of both keys, so staging and production cannot share credentials/data.
  const credentialKey = `sansoni.session.${encodeURIComponent(origin).replace(/%/g, '_')}`;
  const cacheKey = (id: string) =>
    `sansoni.member.${encodeURIComponent(origin)}.${encodeURIComponent(id)}`;
  let credentials: Credentials | null = null;
  let generation = 0;
  let profileRevision = 0;
  let pendingRemovalId: string | undefined;
  let cleanupWasRevoked = true;
  let boot: Promise<void> | undefined;
  let writes = Promise.resolve();
  const serialize = (operation: () => Promise<void>) => {
    const next = writes.then(operation);
    writes = next.catch(() => {});
    return next;
  };
  async function removeMember(id?: string, expected = generation) {
    await queryClient.cancelQueries({ queryKey: ['member', origin] });
    if (generation !== expected) return;
    queryClient.removeQueries({ queryKey: ['member', origin] });
    if (id)
      await serialize(async () => {
        if (generation === expected) await cache.removeItem(cacheKey(id));
      });
  }
  async function clear(loading = true, revoked = true) {
    const expected = ++generation;
    cleanupWasRevoked = revoked;
    pendingRemovalId = credentials?.memberId ?? pendingRemovalId;
    store.setState({ status: loading ? 'loading' : 'signed-out', memberId: undefined, error: '' });
    credentials = null;
    // Remove visible member data even when credential or snapshot deletion fails.
    const results = await Promise.allSettled([
      serialize(() => storage.remove(credentialKey)),
      removeMember(pendingRemovalId, expected),
    ]);
    const cleaned = results.every((result) => result.status === 'fulfilled');
    if (cleaned && generation === expected) pendingRemovalId = undefined;
    if (generation === expected)
      store.setState({
        status: 'signed-out',
        memberId: undefined,
        error: cleaned
          ? ''
          : (revoked ? 'Your server session has ended. ' : '') +
            'Some saved sign-in data could not be removed from this device. Retry clearing this device.',
      });
    return cleaned;
  }
  const request = async (path: string, init: RequestInit = {}) => {
    const requestGeneration = generation;
    const sentToken = credentials?.token;
    const headers = new Headers(init.headers);
    if (nativeOrigin) headers.set('Origin', nativeOrigin);
    if (sentToken) headers.set('Authorization', `Bearer ${sentToken}`);
    let response: Response;
    try {
      response = await fetcher(`${origin}${path}`, {
        ...init,
        headers,
        credentials: 'omit',
        redirect: 'error',
      });
    } catch {
      throw new ApiError('Cannot reach member services. Check your connection and try again.', 0);
    }
    if (requestGeneration !== generation)
      throw new Error('Your session changed. Please try again.');
    if (response.status === 401 && sentToken) {
      await clear();
      throw new ApiError('Your session has expired. Sign in again.', 401);
    }
    const renewed = response.ok && response.headers.get('set-auth-token');
    if (renewed) {
      await serialize(async () => {
        if (requestGeneration !== generation || sentToken !== credentials?.token) return;
        const next = { ...credentials, token: renewed };
        await storage.set(credentialKey, next);
        if (requestGeneration !== generation) throw new Error('Your session changed.');
        credentials = next;
      });
    }
    return response;
  };
  const api = memberAPI(request);
  async function persistMember(id: string, member: MeResponse, expected: number) {
    await serialize(async () => {
      if (generation !== expected) throw new Error('Your session changed.');
      await cache.setItem(cacheKey(id), JSON.stringify({ savedAt: now(), member }));
      if (generation !== expected) {
        await cache.removeItem(cacheKey(id));
        throw new Error('Your session changed.');
      }
    });
  }
  async function publish(member: MeResponse, expectedGeneration: number) {
    if (generation !== expectedGeneration || !credentials) throw new Error('Your session changed.');
    const oldId = credentials.memberId;
    if (oldId && oldId !== member.member.id) await removeMember(oldId);
    if (generation !== expectedGeneration || !credentials) throw new Error('Your session changed.');
    const next = { ...credentials, memberId: member.member.id };
    await serialize(async () => {
      if (generation !== expectedGeneration) throw new Error('Your session changed.');
      await storage.set(credentialKey, next);
      if (generation !== expectedGeneration) throw new Error('Your session changed.');
      credentials = next;
    });
    if (generation !== expectedGeneration) throw new Error('Your session changed.');
    queryClient.setQueryData(memberKey(origin, member.member.id), member);
    await persistMember(member.member.id, member, expectedGeneration);
    if (generation === expectedGeneration)
      store.setState({ status: 'ready', memberId: member.member.id, error: '' });
  }
  async function restoreCachedMember(expected: number) {
    const id = credentials?.memberId;
    const expiresAt = credentials?.expiresAt;
    if (!id || !expiresAt || expiresAt <= now()) return false;
    try {
      const raw = await cache.getItem(cacheKey(id));
      if (generation !== expected) return false;
      const snapshot: unknown = raw ? JSON.parse(raw) : null;
      if (
        !snapshot ||
        typeof snapshot !== 'object' ||
        !('savedAt' in snapshot) ||
        typeof snapshot.savedAt !== 'number' ||
        snapshot.savedAt > now() ||
        now() - snapshot.savedAt > profileCacheMaxAge ||
        !('member' in snapshot)
      )
        return false;
      const result = MeResponseSchema.safeParse(snapshot.member);
      if (!result.success || result.data.member.id !== id || generation !== expected) return false;
      queryClient.setQueryData(memberKey(origin, id), result.data);
      store.setState({ status: 'ready', memberId: id, error: '' });
      return true;
    } catch {
      return false;
    }
  }
  async function probeSession() {
    const expected = generation;
    const session = await responseJSON(await request('/v1/auth/get-session'));
    if (generation !== expected) throw new Error('Your session changed.');
    if (!session || typeof session !== 'object' || !('user' in session) || !session.user) {
      await clear();
      return false;
    }
    const data = 'session' in session ? session.session : null;
    const expiresAt =
      data && typeof data === 'object' && 'expiresAt' in data && typeof data.expiresAt === 'string'
        ? Date.parse(data.expiresAt)
        : NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
      await clear();
      return false;
    }
    await serialize(async () => {
      if (generation !== expected || !credentials) throw new Error('Your session changed.');
      const next = { ...credentials, expiresAt };
      await storage.set(credentialKey, next);
      if (generation !== expected) throw new Error('Your session changed.');
      credentials = next;
    });
    return true;
  }
  async function loadMember() {
    const expected = generation;
    const revision = profileRevision;
    try {
      const member = await api.me();
      if (generation === expected && revision !== profileRevision) return;
      await publish(member, expected);
    } catch (error) {
      if (
        generation === expected &&
        error instanceof ApiError &&
        error.status === 0 &&
        (await restoreCachedMember(expected))
      )
        return;
      throw error;
    }
  }
  async function hydrate(options: { background?: boolean } = {}) {
    if (boot) return boot;
    if (!options.background || store.getState().status !== 'ready')
      store.setState({ status: 'loading', error: '' });
    const expected = generation;
    boot = (async () => {
      try {
        const restored = await storage.get(credentialKey);
        if (generation !== expected) return;
        credentials = restored;
        if (!credentials) {
          store.setState({ status: 'signed-out', error: '' });
          return;
        }
        if (!(await probeSession())) return;
        await loadMember();
      } catch (error) {
        if (
          generation === expected &&
          error instanceof ApiError &&
          error.status === 0 &&
          (await restoreCachedMember(expected))
        )
          return;
        if (generation === expected && store.getState().status !== 'signed-out')
          store.setState({ status: 'error', memberId: undefined, error: errorMessage(error) });
      } finally {
        boot = undefined;
      }
    })();
    return boot;
  }
  async function beginSignIn() {
    if (!(await clear(false, false)))
      throw new Error('Saved sign-in data could not be cleared. Please try again.');
  }
  async function finishSignIn() {
    if (!credentials?.token)
      throw new Error('Sign-in did not return a native session. Request another code.');
    const expected = generation;
    try {
      if (!(await probeSession()))
        throw new Error('Your session has expired. Request another code or link.');
      await loadMember();
    } catch (error) {
      if (generation === expected) store.setState({ status: 'error', error: errorMessage(error) });
      throw error;
    }
  }
  async function signOut() {
    const expected = generation;
    // Never report successful revocation on a network/server failure. Keep the session for retry.
    const response = await request('/v1/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await responseJSON(response);
    if (generation !== expected) throw new Error('Your session changed.');
    await clear();
  }
  async function refreshMember(signal?: AbortSignal) {
    const expected = generation;
    const revision = profileRevision;
    const id = store.getState().memberId;
    if (!id) throw new Error('Sign in before loading member data.');
    const member = await api.me(signal);
    if (generation !== expected || member.member.id !== id) {
      if (generation === expected) await clear();
      throw new Error('Your member account changed. Sign in again.');
    }
    if (revision !== profileRevision || signal?.aborted) {
      const latest = queryClient.getQueryData<MeResponse>(memberKey(origin, id));
      if (latest) return latest;
      throw new Error('Member profile is being updated.');
    }
    await persistMember(id, member, expected);
    if (generation !== expected) throw new Error('Your session changed.');
    store.setState({ error: '' });
    return member;
  }
  async function saveOnboarding(record: Parameters<typeof api.saveOnboarding>[0], key: string) {
    const expected = generation;
    const id = store.getState().memberId;
    if (!id || store.getState().status !== 'ready')
      throw new Error('Sign in before saving your direction.');
    profileRevision++;
    await queryClient.cancelQueries({ queryKey: memberKey(origin, id) });
    if (generation !== expected) throw new Error('Your session changed.');
    const saved = await api.saveOnboarding(record, key);
    if (generation !== expected) throw new Error('Your session changed.');
    const queryKey = memberKey(origin, id);
    const current = queryClient.getQueryData<MeResponse>(queryKey);
    if (!current) throw new Error('Reload your member profile before saving.');
    const updated = { ...current, onboarding: saved };
    await persistMember(id, updated, expected);
    if (generation !== expected) throw new Error('Your session changed.');
    queryClient.setQueryData(queryKey, updated);
    return saved;
  }
  return {
    store,
    request,
    hydrate,
    beginSignIn,
    finishSignIn,
    signOut,
    retryLocalCleanup: () => clear(false, cleanupWasRevoked),
    refreshMember,
    saveOnboarding,
    queryClient,
    origin,
  };
}
export type SessionController = ReturnType<typeof createSessionController>;
