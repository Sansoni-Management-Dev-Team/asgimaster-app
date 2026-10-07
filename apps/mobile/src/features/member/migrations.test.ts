import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoach, stopReply } from '../coach/store';
import { useSupport, useNotificationPreferences } from '../support/store';
import { useEvents } from '../events/store';
import { useMember, createMemberStore, MEMBER_KEY } from '../home/store';
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
let disk: Record<string, string>;
beforeEach(() => {
  stopReply();
  disk = {};
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => disk[key] ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    disk[key] = value;
  });
  useCoach.setState(useCoach.getInitialState(), true);
  useSupport.setState(useSupport.getInitialState(), true);
  useEvents.setState(useEvents.getInitialState(), true);
  useNotificationPreferences.setState(useNotificationPreferences.getInitialState(), true);
});
describe('Existing native preview data', () => {
  it('keeps both sides of the existing Coach conversation without deleting its original record', async () => {
    const key = 'master-app.native.coach.home-preview.v1';
    disk[key] = JSON.stringify({
      version: 1,
      messages: [
        { role: 'user', text: 'My original question' },
        { role: 'assistant', text: 'Original reply' },
      ],
    });
    await useCoach.getState().hydrate();
    expect(useCoach.getState().data.conversations[0].messages.map((m) => m.text)).toEqual([
      'My original question',
      'Original reply',
    ]);
    expect(disk[key]).toContain('My original question');
    expect(disk['master-app.native.coach.v1']).toContain('Original reply');
  });
  it('maps the earlier Support preview to a retained human-support thread', async () => {
    disk['master-app.native.support.home-preview.v1'] = JSON.stringify({
      version: 1,
      messages: [
        { role: 'user', text: 'Help with access' },
        { role: 'assistant', text: 'Sample reply' },
      ],
    });
    await useSupport.getState().hydrate();
    const conversation = useSupport.getState().data.conversations[0];
    expect(conversation.messages.map((m) => m.role)).toEqual(['user', 'agent']);
    expect(conversation.status).toBe('replied');
    expect(conversation.unread).toBe(false);
  });
  it('imports earlier reservations once and never resurrects a cancellation', async () => {
    const anchor = new Date().toISOString().slice(0, 10),
      id = 'focus-' + anchor;
    disk[MEMBER_KEY] = JSON.stringify({
      ...useMember.getInitialState().data,
      eventAnchor: anchor,
      registrations: { [id]: 'registered' },
    });
    await useEvents.getState().hydrate();
    expect(useEvents.getState().data.registrations[id].status).toBe('registered');
    useEvents.getState().change((d) => {
      d.registrations[id].status = 'cancelled';
      d.registrations[id].passId = null;
    });
    await useEvents.getState().retrySave();
    useEvents.setState(useEvents.getInitialState(), true);
    await useEvents.getState().hydrate();
    expect(useEvents.getState().data.registrations[id].status).toBe('cancelled');
  });
  it('restores the two independent notification preferences', async () => {
    disk['master-app.native.notifications.v1'] = JSON.stringify({ push: true, replies: false });
    await useNotificationPreferences.getState().hydrate();
    expect(useNotificationPreferences.getState().data).toEqual({ push: true, replies: false });
  });
  it('clears a failed playback-save warning only after a successful retry', async () => {
    const member = createMemberStore(AsyncStorage);
    await member.getState().hydrate();
    member.getState().watch('blueprint', 600, 1);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full'));
    await member.getState().savePlayback();
    expect(member.getState().error).toContain('Learning progress could not be saved');
    await member.getState().savePlayback();
    expect(member.getState().error).toBe('');
    expect(JSON.parse(disk[MEMBER_KEY]).member.positions.blueprint).toBe(600);
  });
});
