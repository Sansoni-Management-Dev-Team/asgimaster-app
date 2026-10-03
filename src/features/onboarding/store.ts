import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  answerQuestion,
  emptyRecord,
  fields,
  isComplete,
  questions,
  sanitizeRecord,
  STORAGE_KEY,
  type OnboardingRecord,
  type Question,
} from './model';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
type Result =
  { ok: true; record: OnboardingRecord } | { ok: false; error: string; storage?: boolean };
type State = {
  record: OnboardingRecord;
  drafts: Partial<Record<Question, string>>;
  hydration: 'idle' | 'loading' | 'ready' | 'failed';
  saving: boolean;
  storageError: string;
  notice: string;
  enteredApp: boolean;
  nameDraft: string;
  setName: (name: string) => void;
  enterApp: () => void;
  hydrate: () => Promise<void>;
  setDraft: (step: Question, value: string) => void;
  cancelDraft: (step: Question) => void;
  submit: (step: Question, value: string) => Promise<Result>;
};

export function createOnboardingStore(storage: Storage) {
  let loading: Promise<void> | null = null;
  return create<State>((set, get) => ({
    record: emptyRecord(),
    drafts: {},
    hydration: 'idle',
    saving: false,
    storageError: '',
    notice: '',
    enteredApp: false,
    nameDraft: '',
    setName(name) {
      if (typeof name === 'string' && name.trim() && name.trim().length <= 80)
        set({ nameDraft: name.trim().replace(/\s+/g, ' ') });
    },
    enterApp() {
      if (get().hydration === 'ready' && isComplete(get().record)) set({ enteredApp: true });
    },
    hydrate() {
      if (get().hydration === 'ready') return Promise.resolve();
      if (loading) return loading;
      set({ hydration: 'loading', storageError: '' });
      loading = (async () => {
        try {
          const raw = await storage.getItem(STORAGE_KEY);
          let parsed: unknown = null;
          let notice = '';
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              notice = 'Saved progress could not be read. Please enter your answers again.';
            }
            if (
              !parsed ||
              typeof parsed !== 'object' ||
              !('version' in parsed) ||
              parsed.version !== 1 ||
              !('answers' in parsed) ||
              !parsed.answers ||
              typeof parsed.answers !== 'object' ||
              Array.isArray(parsed.answers)
            )
              notice = 'Saved progress could not be read. Please enter your answers again.';
          }
          const record = sanitizeRecord(parsed);
          const drafts = Object.fromEntries(
            questions.map((step) => [step, record.answers[fields[step]] ?? '']),
          );
          set({
            record,
            drafts,
            nameDraft: record.name ?? '',
            hydration: 'ready',
            notice,
            enteredApp: isComplete(record),
          });
        } catch {
          // Do not overwrite data after a failed read; the user can retry hydration.
          set({
            hydration: 'failed',
            storageError: 'Your saved progress could not be loaded. Please try again.',
          });
        } finally {
          loading = null;
        }
      })();
      return loading;
    },
    setDraft(step, value) {
      if (!get().saving)
        set((state) => ({ drafts: { ...state.drafts, [step]: value }, storageError: '' }));
    },
    cancelDraft(step) {
      if (!get().saving)
        set((state) => ({
          drafts: { ...state.drafts, [step]: state.record.answers[fields[step]] ?? '' },
          storageError: '',
        }));
    },
    async submit(step, value) {
      if (get().hydration !== 'ready' || get().saving)
        return { ok: false, error: 'Please wait for your saved progress.' };
      const record = get().nameDraft ? { ...get().record, name: get().nameDraft } : get().record;
      const result = answerQuestion(record, step, value);
      if (result.error) return { ok: false, error: result.error };
      set({ saving: true, storageError: '' });
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(result.record));
        set((state) => ({
          record: result.record,
          notice: '',
          drafts: {
            ...state.drafts,
            [step]: result.record.answers[fields[step]] ?? '',
            ...(step === 'role' ? { income: result.record.answers.incomeRange ?? '' } : {}),
          },
        }));
        return { ok: true, record: result.record };
      } catch {
        const error = 'Your answer could not be saved. It is still here. Please try again.';
        set({ storageError: error });
        return { ok: false, error, storage: true };
      } finally {
        set({ saving: false });
      }
    },
  }));
}

export const useOnboarding = createOnboardingStore(AsyncStorage);
