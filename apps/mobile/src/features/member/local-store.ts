import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
type Disk = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
export type LocalState<T> = {
  data: T;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  warning: string;
  notice: string;
  saving: boolean;
  hydrate: () => Promise<void>;
  change: <R>(update: (data: T) => R, notice?: string) => R | undefined;
  commit: <R>(
    update: (data: T) => R,
    notice?: string,
  ) => Promise<{ saved: true; result: R } | { saved: false; error: string }>;
  retrySave: () => Promise<void>;
};
// The reference models stay pure JavaScript. This adapter owns native async persistence.
export function localStore<T>(
  key: string,
  initial: () => T,
  decode: (raw: string | null) => T,
  migrate?: (disk: Disk) => Promise<T | undefined>,
  disk: Disk = AsyncStorage,
) {
  let writes: Promise<void> = Promise.resolve();
  let revision = 0;
  return create<LocalState<T>>((set, get) => {
    function persist(data: T, optimistic = true) {
      const value = JSON.stringify(data),
        version = ++revision;
      const job = writes.catch(() => {}).then(() => disk.setItem(key, value));
      writes = job;
      return job.then(
        () => {
          if (version === revision) set({ warning: '' });
          return true;
        },
        () => {
          if (version === revision)
            set({
              warning: optimistic
                ? 'Storage is unavailable. Changes are kept for this visit only. Retry saving before closing the app.'
                : 'Your request could not be saved. Please try again.',
            });
          return false;
        },
      );
    }
    return {
      data: initial(),
      status: 'idle',
      warning: '',
      notice: '',
      saving: false,
      async hydrate() {
        if (get().status === 'loading' || get().status === 'ready') return;
        set({ status: 'loading' });
        try {
          const raw = await disk.getItem(key);
          const migrated = raw ? undefined : await migrate?.(disk);
          const data = migrated ?? decode(raw);
          set({ data, status: 'ready', warning: '' });
          if (migrated || !raw) await persist(data);
        } catch {
          set({
            status: 'failed',
            warning: 'Saved data could not be loaded. Retry before making changes.',
          });
        }
      },
      change(update, notice = '') {
        if (get().status !== 'ready' || get().saving) return;
        const data = JSON.parse(JSON.stringify(get().data)) as T;
        const result = update(data);
        if (
          result === false ||
          (result &&
            typeof result === 'object' &&
            (('error' in result && result.error) || ('ok' in result && result.ok === false)))
        )
          return result;
        set({ data, notice });
        void persist(data);
        return result;
      },
      async commit(update, notice = '') {
        if (get().status !== 'ready' || get().saving)
          return { saved: false, error: 'Wait for saved requests to finish loading or saving.' };
        set({ saving: true, warning: '', notice: '' });
        try {
          const data = JSON.parse(JSON.stringify(get().data)) as T;
          const result = update(data);
          if (
            result === false ||
            (result && typeof result === 'object' && 'error' in result && result.error)
          )
            return {
              saved: false,
              error:
                result && typeof result === 'object' && 'error' in result
                  ? String(result.error)
                  : 'This change is unavailable.',
            };
          if (!(await persist(data, false)))
            return {
              saved: false,
              error: 'Your request could not be saved. Your details are still here. Try again.',
            };
          set({ data, notice });
          return { saved: true, result };
        } finally {
          set({ saving: false });
        }
      },
      async retrySave() {
        if (get().status === 'ready' && !get().saving) await persist(get().data);
      },
    };
  });
}
