import { describe, expect, it, jest } from '@jest/globals';
import {
  createMembershipCard,
  formatCardCode,
  isMembershipCard,
  readMembershipCard,
} from './membership-card';
import { createMemberStore, MEMBER_KEY } from './store';
import { createMember, consultationGoal } from './model';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function disk() {
  const values: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => values[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  };
}

describe('Prototype membership cards', () => {
  it('uses a one-year term and clamps leap-day expiry to February 28', () => {
    expect(createMembershipCard(new Date('2026-09-29T22:00:00Z')).expiresOn).toBe('2027-09-29');
    expect(createMembershipCard(new Date('2028-02-29T00:00:00Z')).expiresOn).toBe('2029-02-28');
    expect(isMembershipCard({ code: '00000123', expiresOn: '2027-02-29' })).toBe(false);
  });

  it.each([
    ['12345678', '1234 5678'],
    ['00000123', '0000 0123'],
    ['00000000', '0000 0000'],
  ])('formats %s without losing digits', (code, display) => {
    expect(formatCardCode(code)).toBe(display);
    const card = { code, expiresOn: '2027-09-29' };
    expect(isMembershipCard(card)).toBe(true);
    expect(readMembershipCard(card)).toEqual(card);
  });

  it.each(['1234567', '123456789', 'ABCDEFGH', '1234 5678', 12345678])(
    'rejects an invalid stored numeric code %s',
    (code) => {
      expect(isMembershipCard({ code, expiresOn: '2027-09-29' })).toBe(false);
      expect(readMembershipCard({ code, expiresOn: '2027-09-29' })).toBeNull();
    },
  );

  it.each([
    ['A1B2C3D4E5F6', '61760246'],
    ['ffffffffffff', '76710655'],
    ['000005F5E100', '00000000'],
    ['00000000007B', '00000123'],
    ['123456789012', '98341138'],
  ])('converts legacy hexadecimal %s using its numeric value', (code, expected) => {
    const card = { code, expiresOn: '2020-01-31' };
    expect(isMembershipCard(card)).toBe(false);
    expect(readMembershipCard(card)).toEqual({ ...card, code: expected });
    expect(readMembershipCard({ ...card, expiresOn: '2027-02-29' })).toBeNull();
  });

  it('saves the first card immediately and retains it across reloads and plan/activity previews', async () => {
    const storage = disk();
    const first = createMemberStore(storage);
    await first.getState().hydrate();
    const card = first.getState().data.membershipCard;
    expect(card.code).toMatch(/^\d{8}$/);
    expect(isMembershipCard(card)).toBe(true);
    expect(JSON.parse((await storage.getItem(MEMBER_KEY))!).membershipCard).toEqual(card);
    await first.getState().preset('essentials', 'new');
    const restored = createMemberStore(storage);
    await restored.getState().hydrate();
    expect(restored.getState().data.membershipCard).toEqual(card);
    await restored.getState().preset('paused', 'returning');
    expect(restored.getState().data.membershipCard).toEqual(card);
    const other = createMemberStore(disk());
    await other.getState().hydrate();
    expect(other.getState().data.membershipCard.code).toMatch(/^\d{8}$/);
  });

  it('adds a card to an existing member without replacing their identity or progress', async () => {
    const storage = disk();
    const member = createMember(false, 'payment');
    await storage.setItem(
      MEMBER_KEY,
      JSON.stringify({ version: 1, member, goal: consultationGoal }),
    );
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(store.getState().data.member).toEqual(member);
    expect(store.getState().data.goal).toEqual(consultationGoal);
    expect(isMembershipCard(JSON.parse((await storage.getItem(MEMBER_KEY))!).membershipCard)).toBe(
      true,
    );
  });

  it('keeps an existing expired date instead of rolling the term forward on reload', async () => {
    const storage = disk();
    const card = { code: '00000123', expiresOn: '2020-01-31' };
    await storage.setItem(
      MEMBER_KEY,
      JSON.stringify({
        version: 1,
        member: createMember(true),
        membershipCard: card,
        goal: consultationGoal,
      }),
    );
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(store.getState().data.membershipCard).toEqual(card);
  });

  it('migrates once, saves only the code and retains leading zeros through reloads and every plan preview', async () => {
    const storage = disk();
    const saved = {
      ...createMemberStore(storage).getState().data,
      member: createMember(false, 'payment'),
      membershipCard: { code: '00000000007B', expiresOn: '2020-01-31', issuedBy: 'prototype' },
      goal: consultationGoal,
      eventAnchor: '2026-09-29',
      registrations: { 'focus-2026-09-29': 'registered' },
      retainedField: 'Keep this saved field',
    };
    await storage.setItem(MEMBER_KEY, JSON.stringify(saved));
    storage.setItem.mockClear();
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    const card = { code: '00000123', expiresOn: saved.membershipCard.expiresOn };
    expect(store.getState().data.membershipCard).toEqual(card);
    expect(store.getState().data.member).toEqual(saved.member);
    expect(store.getState().data.goal).toEqual(saved.goal);
    expect(store.getState().data.registrations).toEqual(saved.registrations);
    expect(JSON.parse((await storage.getItem(MEMBER_KEY))!)).toEqual({
      ...saved,
      membershipCard: { ...saved.membershipCard, code: card.code },
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const reloaded = createMemberStore(storage);
    await reloaded.getState().hydrate();
    expect(reloaded.getState().data.membershipCard).toMatchObject(card);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    for (const plan of ['growth', 'essentials', 'payment', 'paused'] as const) {
      await reloaded.getState().preset(plan, 'current');
      const preview = createMemberStore(storage);
      await preview.getState().hydrate();
      expect(preview.getState().data.member.membership).toBe(plan);
      expect(preview.getState().data.membershipCard).toMatchObject(card);
    }
  });

  it('keeps the original record when conversion cannot be saved and retries the same code', async () => {
    const storage = disk();
    const saved = {
      version: 1,
      member: createMember(false),
      membershipCard: { code: 'A1B2C3D4E5F6', expiresOn: '2020-01-31' },
      goal: consultationGoal,
    };
    const raw = JSON.stringify(saved);
    await storage.setItem(MEMBER_KEY, raw);
    storage.setItem.mockClear();
    storage.setItem.mockRejectedValueOnce(new Error('Full'));
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(store.getState().status).toBe('failed');
    expect(await storage.getItem(MEMBER_KEY)).toBe(raw);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await store.getState().hydrate();
    expect(store.getState().status).toBe('ready');
    expect(JSON.parse((await storage.getItem(MEMBER_KEY))!)).toEqual({
      ...saved,
      membershipCard: { ...saved.membershipCard, code: '61760246' },
    });
    expect(storage.setItem.mock.calls[0]).toEqual(storage.setItem.mock.calls[1]);
  });

  it('retries a failed issuance save before exposing the new card', async () => {
    const storage = disk();
    storage.setItem.mockRejectedValueOnce(new Error('Full'));
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(store.getState().status).toBe('failed');
    await store.getState().hydrate();
    expect(store.getState().status).toBe('ready');
    expect(JSON.parse((await storage.getItem(MEMBER_KEY))!).membershipCard).toEqual(
      store.getState().data.membershipCard,
    );
  });
});
