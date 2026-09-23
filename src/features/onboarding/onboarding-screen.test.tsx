import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { OnboardingScreen } from './onboarding-screen';
import { useOnboarding } from './store';
import { type OnboardingRecord } from './model';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('./invitation-welcome', () => ({ InvitationWelcome: () => null }));
jest.mock('./use-motion', () => ({
  useMotion: () => ({ reduced: true, ready: true, active: true }),
}));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
let mockParams: { step?: string; edit?: string; from?: string } = { step: 'decision' };
const mockRedirect = jest.fn((props: unknown) => null);
const mockNavigation = {
  isFocused: () => true,
  getState: () => ({ index: 0, routes: [] }),
  reset: jest.fn(),
};
jest.mock('expo-router', () => ({
  Redirect: (props: unknown) => mockRedirect(props),
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => mockParams,
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, right: 0, bottom: 20, left: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
const complete: OnboardingRecord = {
  version: 1,
  answers: {
    ownershipIntent: 'find-business',
    industry: 'Technology',
    rolePerspective: 'build-business',
    incomeRange: '100-200k',
    goal12Months: 'Build a team',
    challenge: 'Funding',
    skills: 'Leadership',
  },
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  mockParams = { step: 'decision' };
  useOnboarding.setState({ ...useOnboarding.getInitialState(), hydration: 'ready' }, true);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  await act(async () => {
    jest.advanceTimersByTime(50);
  });
}

describe('Native onboarding controls', () => {
  it('enters Home with a fresh stack instead of replaying the introduction', async () => {
    mockParams = { step: 'complete' };
    useOnboarding.setState({ record: complete });
    const screen = await render(<OnboardingScreen />, { wrapper });
    expect(screen.queryByRole('button', { name: 'Replay introduction' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Enter my empire' }));
    await settle();
    expect(mockNavigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'home' }] });
    expect(useOnboarding.getState().record).toEqual(complete);
  });
  it('keeps a deliberate review available from Home and returns to Home after editing', async () => {
    mockParams = { step: 'complete', from: 'home' };
    useOnboarding.setState({ record: complete });
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Edit your 12-month goal' }));
    await settle();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'goal', edit: '1', from: 'home' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    await settle();
    expect(mockNavigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'home' }] });
  });
  it('resumes a completed member at Home when no review step was requested', async () => {
    mockParams = {};
    useOnboarding.setState({ record: complete });
    await render(<OnboardingScreen />, { wrapper });
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/home' });
    expect(mockRouter.setParams).not.toHaveBeenCalled();
  });
  it('redirects stale question history to Home after entry, while explicit review remains available', async () => {
    mockParams = { step: 'skills' };
    useOnboarding.setState({ record: complete, enteredApp: true });
    await render(<OnboardingScreen />, { wrapper });
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/home' });
  });
  it('holds a white selected option for 500ms, then saves and advances without a Continue button', async () => {
    const screen = await render(<OnboardingScreen />, { wrapper });
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Explore my options' }));
    expect(
      screen.getByRole('radio', { name: 'Explore my options' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'direction', edit: '0' },
    });
  });

  it('keeps the text and current screen available after a failed save', async () => {
    mockParams = { step: 'industry' };
    useOnboarding.setState({ record: complete, drafts: { industry: 'Technology' } });
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full'));
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.changeText(screen.getByLabelText('Other industry'), 'Medical services');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').props.children).toMatch(/could not be saved/);
    expect(screen.getByLabelText('Other industry').props.value).toBe('Medical services');
    expect(useOnboarding.getState().record.answers.industry).toBe('Technology');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('cancels an edit without saving and returns to the review', async () => {
    mockParams = { step: 'goal', edit: '1' };
    useOnboarding.setState({ record: complete, drafts: { goal: 'Build a team' } });
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.changeText(screen.getByLabelText('Your 12-month goal (required)'), 'Discard');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel edit' }));
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(useOnboarding.getState().drafts.goal).toBe('Build a team');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'complete', edit: '0' },
    });
  });

  it('requires compatible income after changing an already completed role', async () => {
    mockParams = { step: 'role', edit: '1' };
    useOnboarding.setState({
      record: complete,
      drafts: { role: 'build-business', income: '100-200k' },
    });
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('radio', { name: 'I run the business' }));
    await settle();
    expect(useOnboarding.getState().record.answers.skills).toBe('Leadership');
    expect(useOnboarding.getState().record.answers.incomeRange).toBeUndefined();
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'income', edit: '1' },
    });
  });
  it('cancels a pending choice when Back is pressed', async () => {
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('radio', { name: 'Explore my options' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'welcome', edit: '0' },
    });
  });
  it('only saves the most recent selection after its full dwell', async () => {
    const screen = await render(<OnboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('radio', { name: 'Explore my options' }));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Find a business to buy' }));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(useOnboarding.getState().record.answers.ownershipIntent).toBe('find-business');
  });
});
