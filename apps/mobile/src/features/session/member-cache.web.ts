// Browser sign-in is page-scoped. Keep its named member snapshots in the same lifecycle.
const snapshots = new Map<string, string>();
export const memberCache = {
  getItem: async (key: string) => snapshots.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    snapshots.set(key, value);
  },
  removeItem: async (key: string) => {
    snapshots.delete(key);
  },
};
