import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { CoachScreen } from './screen';
import { stopReply, useCoach, useCoachUI } from './store';
import { createCoachState, currentConversation } from './model';
import { startScenario } from './acquisition';
import { useMember } from '../home/store';
import { createMember } from '../home/model';
import { useSupport } from '../support/store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../onboarding/use-motion', () => ({
  useMotion: () => ({ reduced: true, ready: true, active: true }),
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, right: 0, bottom: 20, left: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
  useCoach.setState(
    { ...useCoach.getInitialState(), data: createCoachState(), status: 'ready' },
    true,
  );
  useCoachUI.setState(useCoachUI.getInitialState(), true);
  useMember.setState(
    {
      ...useMember.getInitialState(),
      status: 'ready',
      data: { ...useMember.getInitialState().data, member: createMember() },
    },
    true,
  );
  useSupport.setState({ ...useSupport.getInitialState(), status: 'ready' }, true);
});
afterEach(() => {
  stopReply();
  jest.useRealTimers();
});

describe('AaronAI acquisition screen', () => {
  it('offers both entry paths, preserves drafts between tabs and keeps new conversations in history', async () => {
    const screen = await render(<CoachScreen go={jest.fn()} />, { wrapper });
    expect(screen.queryByLabelText('Message AaronAI')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'I’m looking for a business' }));
    expect(screen.getByRole('header', { name: 'Where do we start?' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Message AaronAI'), 'My draft');
    await fireEvent.press(screen.getByRole('tab', { name: 'Search Plan' }));
    expect(screen.queryByLabelText('Message AaronAI')).toBeNull();
    expect(screen.getByRole('button', { name: 'Your Buy Box' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.getByLabelText('Message AaronAI').props.value).toBe('My draft');
    await fireEvent.press(screen.getByRole('button', { name: 'New conversation' }));
    await fireEvent.press(screen.getByRole('button', { name: 'I’ve got one in mind' }));
    expect(screen.getByRole('header', { name: 'What’s the deal?' })).toBeTruthy();
    expect(useCoach.getState().data.conversations).toHaveLength(2);
  });
  it('links a reply to its findings and preserves retry and stop behaviour', async () => {
    const screen = await render(<CoachScreen go={jest.fn()} />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'I’ve got one in mind' }));
    await fireEvent.changeText(
      screen.getByLabelText('Message AaronAI'),
      'A local service business',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stop reply' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(currentConversation(useCoach.getState().data)?.acquisition?.facts).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry message' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(currentConversation(useCoach.getState().data)?.acquisition?.facts).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'View Evidence & Findings on plan' }));
    expect(screen.getByRole('tab', { name: 'Deal Plan' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Evidence & Findings' }).props.accessibilityState.expanded,
    ).toBe(true);
    expect(screen.getByText('A local service business')).toBeTruthy();
  });
  it('creates examples from Options, copies summaries and opens the matching plan area', async () => {
    const screen = await render(<CoachScreen go={jest.fn()} />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'AaronAI options' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Demo settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Preview Assessment' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Copy summary' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('Harbour Services'),
    );
    expect(screen.getByText('Summary copied.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'View Numbers on plan' }));
    expect(screen.getByRole('button', { name: 'Numbers' }).props.accessibilityState.expanded).toBe(
      true,
    );
    expect(screen.getByText('Customer concentration needs review')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Numbers' }));
    expect(screen.getByRole('button', { name: 'Numbers' }).props.accessibilityState.expanded).toBe(
      false,
    );
  });
  it('reports copy failures without claiming success', async () => {
    const state = createCoachState();
    startScenario(state, 'DONE');
    useCoach.setState({ data: state });
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
    const screen = await render(<CoachScreen go={jest.fn()} />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Copy summary' }));
    expect(screen.queryByText('Summary copied.')).toBeNull();
    expect(screen.getByText(/Couldn’t copy/)).toBeTruthy();
  });
  it('retains reviewed handoffs with conversation sharing off by default', async () => {
    const state = createCoachState();
    startScenario(state, 'PRE_MEET');
    useCoach.setState({ data: state });
    const go = jest.fn();
    const screen = await render(<CoachScreen go={go} />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'AaronAI options' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Talk to a person' }));
    expect(
      screen.getByRole('checkbox', { name: 'Include this conversation' }).props.accessibilityState
        .checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Review request' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm demo handoff' }));
    expect(go).toHaveBeenCalledWith('support', expect.any(String));
    expect(useSupport.getState().data.conversations).toHaveLength(1);
  });
  it('keeps a plan readable when membership access is locked', async () => {
    const state = createCoachState();
    startScenario(state, 'SCOUTING');
    useCoach.setState({ data: state });
    useMember.setState({
      data: { ...useMember.getState().data, member: createMember(false, 'paused') },
    });
    const screen = await render(<CoachScreen go={jest.fn()} />, { wrapper });
    expect(screen.queryByLabelText('Message AaronAI')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Search Plan' }));
    expect(screen.getByRole('button', { name: 'Your Buy Box' })).toBeTruthy();
  });
});
