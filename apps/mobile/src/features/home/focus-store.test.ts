import { describe, expect, it, jest } from '@jest/globals';
import { createFocusStore, FOCUS_KEY } from './focus-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function storage() {
  let value: string | null = null;
  return {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key: string, next: string) => {
      value = next;
    }),
  };
}
describe('Home weekly focus', () => {
  it('persists a trimmed focus and restores it for the current week', async () => {
    const disk = storage();
    const store = createFocusStore(disk);
    await store.getState().hydrate();
    expect(await store.getState().save('  Contact three businesses  ')).toBe(true);
    const restored = createFocusStore(disk);
    await restored.getState().hydrate();
    expect(restored.getState().note).toBe('Contact three businesses');
    expect(disk.setItem.mock.calls[0][0]).toBe(FOCUS_KEY);
  });
  it('does not carry a previous week’s action into this week', async () => {
    const disk = storage();
    await disk.setItem(
      FOCUS_KEY,
      JSON.stringify({ version: 1, week: '2000-1-3', note: 'Old focus' }),
    );
    const store = createFocusStore(disk);
    await store.getState().hydrate();
    expect(store.getState().note).toBe('');
  });
  it('rejects blank or oversized notes and retains the previous focus after a failed write', async () => {
    const disk = storage();
    const store = createFocusStore(disk);
    await store.getState().hydrate();
    expect(await store.getState().save(' ')).toBe(false);
    expect(await store.getState().save('a'.repeat(401))).toBe(false);
    expect(disk.setItem).not.toHaveBeenCalled();
    await store.getState().save('Original');
    disk.setItem.mockRejectedValueOnce(new Error('Full'));
    expect(await store.getState().save('New focus')).toBe(false);
    expect(store.getState().note).toBe('Original');
    expect(await store.getState().save('New focus')).toBe(true);
  });
  it('blocks writes after a failed read until loading is retried', async () => {
    const disk = storage();
    disk.getItem.mockRejectedValueOnce(new Error('Offline'));
    const store = createFocusStore(disk);
    await store.getState().hydrate();
    expect(store.getState().status).toBe('failed');
    expect(await store.getState().save('Do not overwrite')).toBe(false);
    expect(disk.setItem).not.toHaveBeenCalled();
    await store.getState().hydrate();
    expect(await store.getState().save('Retry')).toBe(true);
  });
});
