import { describe, expect, it, jest } from '@jest/globals';
import { createMember, consultationGoal, getDashboard } from '../home/model';
import { getLibrary, contentState, libraryCatalogue } from '../library/model';
import * as E from '../events/model';
import * as C from '../coach/model';
import * as S from '../support/model';
import { localStore } from './local-store';
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const now = Date.parse('2026-09-23T00:00:00Z');
describe('Migrated Library rules', () => {
  it('preserves collections, restrictions and unavailable recordings', () => {
    const member = createMember();
    const d = getLibrary(member);
    expect(d.groups.map((g) => g.id)).toEqual(['foundations', 'growth', 'leadership', 'sessions']);
    expect([d.includedCount, d.comingSoonCount, d.lockedCount]).toEqual([6, 1, 1]);
    expect(
      contentState(
        member,
        libraryCatalogue.find((l) => l.id === 'live-review')!,
      ),
    ).toBe('unavailable');
    expect(
      contentState(
        member,
        libraryCatalogue.find((l) => l.id === 'scaling')!,
      ),
    ).toBe('locked');
    expect(getLibrary(member, { scope: 'all' }).groups).toHaveLength(5);
  });
  it('composes token search, collection and progress without leaking access', () => {
    expect(
      getLibrary(createMember(), {
        query: ' GROWTH  blueprint ',
        progress: 'in-progress',
      }).items.map((l) => l.id),
    ).toEqual(['blueprint']);
    const member = createMember(false, 'essentials');
    expect(getLibrary(member, { query: 'blueprint' }).items).toEqual([]);
    expect(getLibrary(member, { collection: 'growth' }).collection).toBe('all');
    expect(getLibrary(member, { scope: 'all', query: 'blueprint' }).items).toHaveLength(1);
  });
});
describe('Migrated event lifecycle', () => {
  it('registers once, revokes passes, issues new revisions, and records attendance separately', () => {
    const state = E.createEventState(now),
      member = createMember(),
      event = E.eventCatalogue(state).find((e) => e.key === 'focus')!,
      before = getDashboard(member, consultationGoal);
    expect(E.registerEvent(member, state, event, now).changed).toBe(true);
    expect(E.registerEvent(member, state, event, now).changed).toBe(false);
    const pass = state.registrations[event.id].passId;
    expect(E.cancelRegistration(member, state, event).ok).toBe(true);
    expect(state.registrations[event.id].passId).toBeNull();
    E.registerEvent(member, state, event, now);
    expect(state.registrations[event.id].revision).toBe(2);
    expect(state.registrations[event.id].passId).not.toBe(pass);
    E.simulateCheckIn(member, state, event, now);
    expect(E.simulateCheckIn(member, state, event, now).changed).toBe(false);
    expect(E.cancelRegistration(member, state, event).ok).toBe(false);
    expect(E.eventProgress(member, state, now).attended).toHaveLength(1);
    expect(getDashboard(member, consultationGoal)).toEqual(before);
  });
  it('rejects full, cancelled, ended and inaccessible registrations and ticket routes', () => {
    const state = E.createEventState(now),
      member = createMember();
    for (const event of E.eventCatalogue(state).filter((e) =>
      ['team', 'weekly', 'review', 'strategy'].includes(e.key),
    ))
      expect(E.registerEvent(member, state, event, now).ok).toBe(false);
    expect(E.parseEventRoute('#events/mine/ticket').view).toBe('unavailable');
    expect(
      E.selectEvents(createMember(false, 'paused'), state, { now }).every(
        (e) => e.access === 'foundation',
      ),
    ).toBe(true);
  });
  it('keeps old attendance and adds a fresh cohort after expiry', () => {
    const state = E.createEventState(now),
      event = E.eventCatalogue(state).find((e) => e.key === 'focus')!,
      member = createMember();
    E.registerEvent(member, state, event, now);
    E.simulateCheckIn(member, state, event, now);
    const restored = E.loadEvents({ getItem: () => JSON.stringify(state) }, now + 40 * 86400000);
    expect(restored.anchors).toHaveLength(2);
    expect(E.eventProgress(member, restored, now + 40 * 86400000).attended[0].id).toBe(event.id);
    expect(E.nextEvent(member, restored, now + 40 * 86400000)).toBeTruthy();
  });
});
describe('Migrated Coach and Support', () => {
  it('does not invent a goal for members who have not set their direction', () => {
    const reply = C.demoReply('Help me plan my week', createMember(true), {
      name: '',
      success: '',
      weeks: '52',
    });
    expect(reply.text).toContain('set up your direction from Home');
    expect(reply.text).not.toContain('“”');
  });
  it('restores unlimited chat history beyond the old entry-screen truncation', () => {
    const state = C.createCoachState(),
      member = createMember();
    for (let i = 0; i < 130; i++) {
      const request = C.beginMessage(state, 'Question ' + i, member);
      if ('error' in request) throw new Error(request.error);
      C.resolveMessage(state, request, { text: 'Reply ' + i }, member);
    }
    for (let i = 0; i < 35; i++) {
      state.activeId = null;
      const request = C.beginMessage(state, 'New chat ' + i, member);
      if ('error' in request) throw new Error(request.error);
      C.resolveMessage(state, request, { text: 'Reply' }, member);
    }
    const restored = C.loadCoach({ getItem: () => JSON.stringify(state) });
    expect(restored.conversations).toHaveLength(36);
    expect(restored.conversations.at(-1)?.messages).toHaveLength(260);
  });
  it('prevents concurrent sends, retries the same question and refuses stale replies', () => {
    const state = C.createCoachState(),
      member = createMember();
    const request = C.beginMessage(state, 'Help', member);
    if ('error' in request) throw new Error(request.error);
    expect(C.beginMessage(state, 'Duplicate', member)).toHaveProperty('error');
    C.failMessage(state, request);
    const retry = C.retryMessage(state, request.messageId, member);
    expect(retry).toEqual(request);
    C.resolveMessage(state, request, { text: 'Hello' }, member, 'waitlist');
    expect(state.conversations[0].messages).toHaveLength(1);
    expect(state.conversations[0].messages[0].status).toBe('failed');
    expect(C.resolveMessage(state, request, { text: 'Late' }, member)).toBe(false);
  });
  it('turns interrupted pending requests into retryable messages on reload', () => {
    const state = C.createCoachState();
    C.beginMessage(state, 'Hello', createMember());
    const restored = C.loadCoach({
      getItem: () => JSON.stringify({ ...state, used: 999, day: 'old' }),
    });
    expect(restored.conversations[0].messages[0].status).toBe('failed');
    expect(Object.hasOwn(restored, 'used')).toBe(false);
  });
  it('shares only the reviewed snapshot, with sharing off by default', () => {
    const state = C.createCoachState(),
      member = createMember(),
      request = C.beginMessage(state, 'Help with my plan', member);
    if ('error' in request) throw new Error(request.error);
    const chat = C.currentConversation(state)!;
    expect(C.buildHandoff(chat, { note: 'Help' }, member).transcript).toBe('');
    const review = C.buildHandoff(chat, { note: 'Help', includeConversation: true }, member);
    C.resolveMessage(state, request, { text: 'Later answer' }, member);
    expect(review.transcript).toContain('no reply received');
    expect(review.transcript).not.toContain('Later answer');
    const support = S.createSupportState();
    const result = S.startConversation(support, { text: review.note, context: review.transcript });
    expect(result.conversation?.context).toBe(review.transcript);
  });
  it('keeps resolution, unread state, deep links and conversation messages', () => {
    const state = S.createSupportState();
    const chat = S.startConversation(state, {
      topic: 'technical',
      text: 'Video issue',
    }).conversation!;
    S.agentReply(state, chat.id);
    expect(S.unreadCount(state)).toBe(1);
    S.markRead(state, chat.id);
    expect(S.unreadCount(state)).toBe(0);
    S.resolveConversation(state, chat.id);
    expect(S.listConversations(state, true)).toHaveLength(1);
    expect(S.sendMessage(state, chat.id, 'Hello')).toHaveProperty('error');
    S.reopenConversation(state, chat.id);
    expect(S.listConversations(state)).toHaveLength(1);
    expect(chat.messages).toHaveLength(4);
    expect(S.parseSupportRoute(S.supportLink(chat.id)).id).toBe(chat.id);
  });
  it('validates consultant access and capacity without deleting older requests', () => {
    const state = S.createSupportState();
    expect(S.startConversation(state, { topic: 'consultant', text: 'Help' })).toHaveProperty(
      'error',
    );
    for (let i = 0; i < S.MAX_CONVERSATIONS; i++)
      S.startConversation(state, { text: 'Request ' + i });
    expect(S.startConversation(state, { text: 'One more' })).toHaveProperty('error');
    expect(state.conversations).toHaveLength(30);
  });
});
describe('Native storage bridge', () => {
  it('blocks unread data, retries reads, and keeps unsaved mutations visibly in memory', async () => {
    let saved: string | null = null;
    const disk = {
      getItem: jest.fn(async () => saved),
      setItem: jest.fn(async (_k: string, v: string) => {
        saved = v;
      }),
    };
    const make = () =>
      localStore(
        'test',
        () => ({ count: 0 }),
        (raw) => JSON.parse(raw ?? '{"count":0}') as { count: number },
        undefined,
        disk,
      );
    const store = make();
    disk.getItem.mockRejectedValueOnce(new Error('blocked'));
    await store.getState().hydrate();
    expect(store.getState().status).toBe('failed');
    expect(store.getState().change((d) => d.count++)).toBeUndefined();
    await store.getState().hydrate();
    disk.setItem.mockRejectedValueOnce(new Error('full'));
    store.getState().change((d) => d.count++);
    await Promise.resolve();
    await Promise.resolve();
    await store.getState().retrySave();
    expect(store.getState().data.count).toBe(1);
    const restored = make();
    await restored.getState().hydrate();
    expect(restored.getState().data.count).toBe(1);
  });
  it('serializes async writes so an older save cannot erase a later mutation', async () => {
    let saved: string | null = null;
    const disk = {
      getItem: async () => saved,
      setItem: async (_k: string, value: string) => {
        await new Promise((r) => setTimeout(r, value.includes(':1') ? 10 : 0));
        saved = value;
      },
    };
    const store = localStore(
      'order',
      () => ({ count: 0 }),
      (raw) => JSON.parse(raw ?? '{"count":0}') as { count: number },
      undefined,
      disk,
    );
    await store.getState().hydrate();
    store.getState().change((d) => (d.count = 1));
    store.getState().change((d) => (d.count = 2));
    await store.getState().retrySave();
    expect(JSON.parse(saved!).count).toBe(2);
  });
});
