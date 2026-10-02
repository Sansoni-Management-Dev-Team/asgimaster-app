import { describe, expect, it } from '@jest/globals';
import { createMember } from '../home/model';
import {
  beginMessage,
  createCoachState,
  currentConversation,
  failMessage,
  loadCoach,
  resolveMessage,
  retryMessage,
} from './model';
import {
  acquisitionReply,
  cleanAcquisition,
  scenarioState,
  scenarios,
  startAcquisition,
  startScenario,
} from './acquisition';

const restore = (data: unknown) => loadCoach({ getItem: () => JSON.stringify(data) });
describe('Acquisition conversations', () => {
  it('restores an empty selected entry and leaves existing chats without acquisition metadata', () => {
    const state = createCoachState(),
      member = createMember();
    const legacy = beginMessage(state, 'My previous coaching question', member);
    expect(legacy).not.toHaveProperty('error');
    state.activeId = null;
    const chat = startAcquisition(state, 'searching');
    const loaded = restore(state);
    expect(currentConversation(loaded)?.id).toBe(chat.id);
    expect(currentConversation(loaded)?.acquisition?.stage).toBe('SCOUTING');
    expect(loaded.conversations[1].messages[0].text).toBe('My previous coaching question');
    expect(loaded.conversations[1].acquisition).toBeUndefined();
  });
  it('only applies plan changes after a successful reply and prevents duplicate retries', () => {
    const state = createCoachState(),
      member = createMember();
    const chat = startAcquisition(state, 'has_target');
    const request = beginMessage(state, 'I have a business in mind', member);
    if ('error' in request) throw new Error(request.error);
    const reply = acquisitionReply('I have a business in mind', chat.acquisition!);
    failMessage(state, request);
    expect(resolveMessage(state, request, reply, member)).toBe(false);
    expect(chat.acquisition?.facts).toEqual([]);
    retryMessage(state, request.messageId, member);
    expect(resolveMessage(state, request, reply, member)).toBe(true);
    expect(resolveMessage(state, request, reply, member)).toBe(false);
    expect(chat.acquisition?.facts).toHaveLength(1);
    expect(chat.acquisition?.direction).toBeNull();
    expect(chat.acquisition?.askingPrice).toBe('');
    expect(restore(state).conversations[0].messages[1].updates?.[0].key).toBe('evidence');
  });
  it('does not populate a plan after access changes', () => {
    const state = createCoachState(),
      member = createMember();
    const chat = startAcquisition(state, 'searching');
    const request = beginMessage(state, 'A note', member);
    if ('error' in request) throw new Error(request.error);
    expect(
      resolveMessage(
        state,
        request,
        acquisitionReply('A note', chat.acquisition!),
        member,
        'unavailable',
      ),
    ).toBe(false);
    expect(chat.acquisition?.facts).toHaveLength(0);
    expect(chat.messages[0].status).toBe('failed');
  });
  it.each(scenarios.map(([stage]) => stage))(
    'keeps %s examples separate and restores summaries and update links',
    (stage) => {
      const state = createCoachState();
      const real = startAcquisition(state, 'searching');
      const sample = startScenario(state, stage);
      const loaded = restore(state);
      expect(loaded.conversations).toHaveLength(2);
      expect(loaded.conversations[0].acquisition?.example).toBe(true);
      expect(loaded.conversations[0].acquisition?.stage).toBe(stage);
      expect(loaded.conversations[0].messages[0].summary).toEqual(sample.messages[0].summary);
      expect(loaded.conversations[1].id).toBe(real.id);
      expect(loaded.conversations[1].acquisition?.facts).toEqual([]);
    },
  );
  it('drops corrupt acquisition metadata without losing messages and bounds restored progress', () => {
    const state = createCoachState();
    const chat = startScenario(state, 'SIZE_UP');
    const bad = JSON.parse(JSON.stringify(state));
    bad.conversations[0].acquisition.stage = 'bad-stage';
    bad.conversations[0].messages[0].updates = [{ key: 'bad-section', label: 'bad', count: 2 }];
    const loaded = restore(bad);
    expect(loaded.conversations[0].messages[0].text).toBe(chat.messages[0].text);
    expect(loaded.conversations[0].acquisition).toBeUndefined();
    expect(loaded.conversations[0].messages[0].updates).toEqual([]);
    const plan = scenarioState('SIZE_UP').acquisition;
    expect(
      cleanAcquisition({ ...plan, progress: { answered: 900, total: 4 }, unread: -4 })?.progress,
    ).toEqual({ answered: 4, total: 4 });
  });
});
