import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
type Disk = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
export type LocalState<T> = {
  data: T;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  warning: string;
  notice: string;
  hydrate: () => Promise<void>;
  change: <R>(update: (data: T) => R, notice?: string) => R | undefined;
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
    function persist(data: T) {
      const value = JSON.stringify(data),
        version = ++revision;
      const job = writes.catch(() => {}).then(() => disk.setItem(key, value));
      writes = job;
      return job.then(
        () => {
          if (version === revision) set({ warning: '' });
        },
        () => {
          if (version === revision)
            set({
              warning:
                'Storage is unavailable. Changes are kept for this visit only. Retry saving before closing the app.',
            });
        },
      );
    }
    return {
      data: initial(),
      status: 'idle',
      warning: '',
      notice: '',
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
        if (get().status !== 'ready') return;
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
      async retrySave() {
        if (get().status === 'ready') await persist(get().data);
      },
    };
  });
}
