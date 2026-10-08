import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const FOCUS_KEY = 'master-app.native.weekly-focus.v1';
export const FOCUS_LIMIT = 400;

function weekOf(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type State = {
  note: string;
  week: string;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  saving: boolean;
  error: string;
  hydrate: () => Promise<void>;
  save: (note: string) => Promise<boolean>;
};

// Device-local weekly action, matching the existing Home's "Set weekly focus" action.
export function createFocusStore(storage: Storage) {
  return create<State>((set, get) => ({
    note: '',
    week: '',
    status: 'idle',
    saving: false,
    error: '',
    async hydrate() {
      const week = weekOf();
      if (get().status === 'loading' || (get().status === 'ready' && get().week === week)) return;
      set({ status: 'loading', error: '' });
      try {
        const raw = await storage.getItem(FOCUS_KEY);
        let value;
        try {
          value = raw ? JSON.parse(raw) : null;
        } catch {
          value = null;
        }
        const note =
          value?.version === 1 &&
          value.week === week &&
          typeof value.note === 'string' &&
          value.note.trim().length <= FOCUS_LIMIT
            ? value.note.trim()
            : '';
        set({ note, week, status: 'ready' });
      } catch {
        set({
          status: 'failed',
          error: 'Your weekly focus could not be loaded. Please try again.',
        });
      }
    },
    async save(value) {
      if (get().status !== 'ready' || get().saving) return false;
      const note = value.trim();
      if (!note || note.length > FOCUS_LIMIT) {
        set({ error: `Enter your next action in ${FOCUS_LIMIT} characters or fewer.` });
        return false;
      }
      set({ saving: true, error: '' });
      const week = weekOf();
      try {
        await storage.setItem(FOCUS_KEY, JSON.stringify({ version: 1, week, note }));
        set({ note, week });
        return true;
      } catch {
        set({
          error: 'Your focus could not be saved. Your draft is still here. Please try again.',
        });
        return false;
      } finally {
        set({ saving: false });
      }
    },
  }));
}

export const useWeeklyFocus = createFocusStore(AsyncStorage);
