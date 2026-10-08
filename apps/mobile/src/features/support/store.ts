import { create } from 'zustand';
import { localStore } from '../member/local-store';
import { createSupportState, loadSupport } from './model';
export const useSupport = localStore(
  'master-app.native.support.v1',
  createSupportState,
  (raw) => loadSupport({ getItem: () => raw }),
  async (disk) => {
    const raw = await disk.getItem('master-app.native.support.home-preview.v1');
    if (!raw) return;
    try {
      const old = JSON.parse(raw);
      if (!Array.isArray(old.messages) || !old.messages.length) return;
      const now = new Date().toISOString();
      return loadSupport({
        getItem: () =>
          JSON.stringify({
            version: 1,
            conversations: [
              {
                id: 'migrated-support',
                topic: 'general',
                status: 'replied',
                unread: false,
                createdAt: now,
                updatedAt: now,
                messages: old.messages.map((m: { role: string; text: string }, i: number) => ({
                  ...m,
                  role: m.role === 'assistant' ? 'agent' : 'user',
                  id: `support-migrated-${i}`,
                  createdAt: now,
                })),
                context: '',
              },
            ],
          }),
      });
    } catch {
      return;
    }
  },
);
export const useSupportUI = create<{
  failNext: boolean;
  drafts: Record<string, string>;
  notification: string | null;
  newTopic: string;
  setDraft: (id: string, text: string) => void;
}>((set) => ({
  failNext: false,
  drafts: {},
  notification: null,
  newTopic: 'general',
  setDraft: (id, text) => set((s) => ({ drafts: { ...s.drafts, [id]: text } })),
}));
export const useNotificationPreferences = localStore(
  'master-app.native.notifications.v1',
  () => ({ push: false, replies: false }),
  (raw) => {
    try {
      const value = JSON.parse(raw ?? 'null');
      return { push: value?.push === true, replies: value?.replies === true };
    } catch {
      return { push: false, replies: false };
    }
  },
);
