import { localStore } from '../member/local-store';
import { createEventState, loadEvents, type EventState } from './model';
import { MEMBER_KEY } from '../home/store';
export const EVENT_KEY = 'master-app.native.events.v1';
export const useEvents = localStore(
  EVENT_KEY,
  createEventState,
  (raw) => loadEvents({ getItem: () => raw }),
  async (disk) => {
    const raw = await disk.getItem(MEMBER_KEY);
    if (!raw) return;
    try {
      const old = JSON.parse(raw);
      if (!old.eventAnchor) return;
      const state: EventState = { version: 1, anchors: [old.eventAnchor], registrations: {} };
      for (const [id, status] of Object.entries(old.registrations ?? {})) {
        if (status === 'registered' || status === 'cancelled')
          state.registrations[id] = {
            status,
            registeredAt: Date.now(),
            revision: 1,
            passId: status === 'registered' ? `DEMO-${id.toUpperCase()}-1` : null,
            checkedInAt: null,
          };
      }
      return loadEvents({ getItem: () => JSON.stringify(state) });
    } catch {
      return;
    }
  },
);
