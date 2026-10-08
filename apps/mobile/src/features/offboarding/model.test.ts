import { describe, expect, it, jest } from '@jest/globals';
import { localStore } from '../member/local-store';
import { createMemberStore } from '../home/store';
import { createSupportState, loadSupport, resolveConversation, agentReply } from '../support/model';
import { callbackErrors, emptyDraft, pendingOffboarding, startOffboarding } from './model';
import { normalisePhone, readOffboarding, type OffboardingIntent } from './metadata';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const membership = { plan: 'Growth', status: 'active', cardCode: 'A1B2C3D4E5F6' };
const draft = (intent: OffboardingIntent = 'discuss') => ({
  ...emptyDraft(),
  intent,
  phone: '+61 400 000 000',
});
function disk() {
  const values: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => values[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  };
}
const supportStore = (storage: ReturnType<typeof disk>) =>
  localStore(
    'support-test',
    createSupportState,
    (raw) => loadSupport({ getItem: () => raw }),
    undefined,
    storage,
  );

describe('Programme off-boarding requests', () => {
  it.each(['discuss', 'digital-access', 'leave-programme'] as const)(
    'records %s with optional reasons and a normalised callback number',
    (intent) => {
      const state = createSupportState();
      const result = startOffboarding(state, draft(intent), membership);
      expect(result.conversation?.offboarding).toEqual({
        ...draft(intent),
        phone: '+61400000000',
        membership,
      });
      expect(result.conversation?.topic).toBe('account');
      expect(result.conversation?.status).toBe('waiting');
      expect(state.conversations).toHaveLength(1);
      expect(normalisePhone('+61 (400) 000-000')).toBe('+61400000000');
    },
  );
  it.each(['', '0400000000', '+123', '+000000000', '+61400hello000', '+1234567890123456'])(
    'rejects invalid phone %s without creating a request',
    (phone) => {
      const state = createSupportState();
      expect(startOffboarding(state, { ...draft(), phone }, membership).error).toContain(
        'country code',
      );
      expect(state.conversations).toHaveLength(0);
    },
  );
  it('enforces note/time limits and restores optional metadata without breaking older conversations', () => {
    expect(callbackErrors({ ...draft(), note: 'x'.repeat(401) }).note).toBeTruthy();
    expect(
      callbackErrors({ ...draft(), preferredTime: 'x'.repeat(161) }).preferredTime,
    ).toBeTruthy();
    const state = createSupportState();
    const result = startOffboarding(
      state,
      {
        ...draft(),
        reason: 'cost',
        note: 'My budget changed',
        preferredTime: 'Weekdays, Sydney time',
      },
      membership,
    );
    const restored = loadSupport({ getItem: () => JSON.stringify(state) });
    expect(restored.conversations[0]).toEqual(result.conversation);
    const invalid = { ...result.conversation!, offboarding: { intent: 'invalid' } };
    const old = {
      ...result.conversation!,
      id: 'old-request',
      offboarding: undefined,
      messages: result.conversation!.messages.map((m) => ({ ...m, id: 'old-message' })),
    };
    const mixed = loadSupport({
      getItem: () => JSON.stringify({ version: 1, conversations: [invalid, old] }),
    });
    expect(mixed.conversations).toHaveLength(2);
    expect(mixed.conversations.every((c) => !c.offboarding)).toBe(true);
    expect(readOffboarding({ ...result.conversation!.offboarding, phone: 'bad' })).toBeUndefined();
  });
  it('reuses an open request, including after a reply, but allows a new request after resolution', () => {
    const state = createSupportState();
    const first = startOffboarding(state, draft(), membership).conversation!;
    agentReply(state, first.id);
    expect(pendingOffboarding(state)?.id).toBe(first.id);
    expect(startOffboarding(state, draft('leave-programme'), membership).conversation?.id).toBe(
      first.id,
    );
    expect(state.conversations).toHaveLength(1);
    resolveConversation(state, first.id);
    expect(pendingOffboarding(state)).toBeUndefined();
    expect(startOffboarding(state, draft('leave-programme'), membership).conversation?.id).not.toBe(
      first.id,
    );
  });
});

describe('Awaited Support persistence', () => {
  it('does not expose success before saving, blocks concurrent submissions and retains exactly one request on retry', async () => {
    const storage = disk();
    const store = supportStore(storage);
    await store.getState().hydrate();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = storage.setItem.getMockImplementation()!;
    storage.setItem.mockImplementationOnce(async (key, value) => {
      await pending;
      await write(key, value);
    });
    const first = store.getState().commit((s) => startOffboarding(s, draft(), membership));
    expect(store.getState().saving).toBe(true);
    expect(store.getState().data.conversations).toHaveLength(0);
    expect(
      (await store.getState().commit((s) => startOffboarding(s, draft(), membership))).saved,
    ).toBe(false);
    expect(
      store.getState().change((s) => {
        s.conversations = [];
      }),
    ).toBeUndefined();
    release();
    expect((await first).saved).toBe(true);
    expect(
      (await store.getState().commit((s) => startOffboarding(s, draft(), membership))).saved,
    ).toBe(true);
    expect(store.getState().data.conversations).toHaveLength(1);
    const restored = supportStore(storage);
    await restored.getState().hydrate();
    expect(restored.getState().data).toEqual(store.getState().data);
  });
  it('leaves the request unsubmitted after a write failure and saves a single request on retry', async () => {
    const storage = disk();
    const store = supportStore(storage);
    await store.getState().hydrate();
    storage.setItem.mockRejectedValueOnce(new Error('Full'));
    expect(
      (await store.getState().commit((s) => startOffboarding(s, draft(), membership))).saved,
    ).toBe(false);
    expect(store.getState().data.conversations).toHaveLength(0);
    expect(store.getState().saving).toBe(false);
    expect(
      (await store.getState().commit((s) => startOffboarding(s, draft(), membership))).saved,
    ).toBe(true);
    expect(store.getState().data.conversations).toHaveLength(1);
  });
  it('preserves every member field, card expiry and access through submission and resolution', async () => {
    const storage = disk();
    const member = createMemberStore(storage);
    await member.getState().hydrate();
    const before = JSON.parse(JSON.stringify(member.getState().data));
    const support = supportStore(storage);
    await support.getState().hydrate();
    await support
      .getState()
      .commit((s) => startOffboarding(s, draft('leave-programme'), membership));
    const id = support.getState().data.conversations[0].id;
    await support.getState().commit((s) => resolveConversation(s, id));
    const restoredMember = createMemberStore(storage);
    await restoredMember.getState().hydrate();
    expect(restoredMember.getState().data).toEqual(before);
  });
});
