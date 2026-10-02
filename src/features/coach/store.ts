import { create } from 'zustand';
import { localStore } from '../member/local-store';
import {
  createCoachState,
  loadCoach,
  beginMessage,
  retryMessage,
  failMessage,
  resolveMessage,
  demoReply,
  coachAccess,
  type Request,
} from './model';
import { useMember } from '../home/store';
import {
  acquisitionReply,
  startAcquisition,
  startScenario,
  type Entry,
  type Stage,
} from './acquisition';
export const useCoach = localStore(
  'master-app.native.coach.v1',
  createCoachState,
  (raw) => loadCoach({ getItem: () => raw }),
  async (disk) => {
    const raw = await disk.getItem('master-app.native.coach.home-preview.v1');
    if (!raw) return;
    try {
      const old = JSON.parse(raw);
      if (!Array.isArray(old.messages) || !old.messages.length) return;
      const now = new Date().toISOString();
      return loadCoach({
        getItem: () =>
          JSON.stringify({
            version: 1,
            activeId: 'migrated-coach',
            conversations: [
              {
                id: 'migrated-coach',
                title: old.messages[0].text,
                createdAt: now,
                updatedAt: now,
                messages: old.messages.map((m: { role: string; text: string }, i: number) => ({
                  ...m,
                  id: `migrated-${i}`,
                  status: 'sent',
                  createdAt: now,
                })),
              },
            ],
          }),
      });
    } catch {
      return;
    }
  },
);
export const useCoachUI = create<{
  mode: string;
  failNext: boolean;
  drafts: Record<string, string>;
  setMode: (mode: string) => void;
  setDraft: (id: string, value: string) => void;
}>((set) => ({
  mode: 'demo',
  failNext: false,
  drafts: {},
  setMode: (mode) => {
    stopReply('Availability changed. Retry when ready.');
    set({ mode });
  },
  setDraft: (id, value) => set((s) => ({ drafts: { ...s.drafts, [id]: value } })),
}));
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Request | undefined;
export function openAcquisition(entry: Entry, scenario?: Stage): string | undefined {
  if (coachAccess(useMember.getState().data.member, useCoachUI.getState().mode) !== 'demo')
    return 'New conversations are not available right now.';
  stopReply();
  const chat = useCoach
    .getState()
    .change((s) => (scenario ? startScenario(s, scenario) : startAcquisition(s, entry)));
  return chat ? undefined : 'Your conversations are still loading.';
}
export function stopReply(detail = 'You stopped this reply. Retry whenever you’re ready.') {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const request = pending;
  pending = undefined;
  if (request) useCoach.getState().change((s) => failMessage(s, request, detail), 'Reply stopped.');
}
export function sendCoach(text: string, retryId?: string): string | undefined {
  const store = useCoach.getState(),
    member = useMember.getState().data.member,
    ui = useCoachUI.getState();
  const result = store.change((s) =>
    retryId ? retryMessage(s, retryId, member, ui.mode) : beginMessage(s, text, member, ui.mode),
  );
  if (!result) return 'Your conversations are still loading.';
  if ('error' in result) return result.error;
  pending = result;
  const shouldFail = ui.failNext;
  useCoachUI.setState({ failNext: false });
  timer = setTimeout(() => {
    if (pending !== result) return;
    pending = undefined;
    timer = undefined;
    const latest = useMember.getState().data;
    useCoach.getState().change(
      (s) => {
        if (shouldFail) return failMessage(s, result, 'No reply arrived. Retry when you’re ready.');
        const chat = s.conversations.find((c) => c.id === result.chatId);
        const message = chat?.messages.find((m) => m.id === result.messageId);
        if (message)
          resolveMessage(
            s,
            result,
            chat?.acquisition
              ? acquisitionReply(message.text, chat.acquisition)
              : demoReply(message.text, latest.member, latest.goal),
            latest.member,
            useCoachUI.getState().mode,
          );
      },
      shouldFail ? 'Reply failed. Your question is ready to retry.' : 'Sample reply ready.',
    );
  }, 950);
}
