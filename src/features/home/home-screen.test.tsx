import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeScreen } from './home-screen';
import { useMember } from './store';
import { useOnboarding } from '../onboarding/store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const mockRouter = { push: jest.fn() };
let mockParams: { view?: string } = {};
jest.mock('../library/player', () => ({ LessonScreen: () => null }));
jest.mock('../onboarding/use-motion', () => ({
  useMotion: () => ({ reduced: true, ready: true, active: true }),
}));
const mockRedirect = jest.fn((props: unknown) => null);
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockParams,
  Redirect: (props: unknown) => mockRedirect(props),
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, right: 0, bottom: 20, left: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  useOnboarding.setState(
    {
      ...useOnboarding.getInitialState(),
      hydration: 'ready',
      record: {
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
      },
    },
    true,
  );
  useMember.setState({ ...useMember.getInitialState(), status: 'ready', now: Date.now() }, true);
  mockParams = {};
});
describe('Home entry', () => {
  it('restores the reference dashboard with functional rings and learning action', async () => {
    const screen = await render(<HomeScreen />, { wrapper });
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Your focus: Grow with focus')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Course: 2 of 6/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Learning: 26 of 60/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue learning' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/home',
      params: { view: 'lesson', id: 'blueprint' },
    });
  });
  it('cannot bypass unfinished questions', async () => {
    useOnboarding.setState({ record: { version: 1, answers: {} } });
    await render(<HomeScreen />, { wrapper });
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/onboarding' });
  });
  it('validates a focus, preserves failed drafts, saves and cancels later edits', async () => {
    const screen = await render(<HomeScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: /Actions:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set weekly focus' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save focus' }));
    expect(screen.getByRole('alert').props.children).toMatch(/Add a short note/);
    await fireEvent.changeText(
      screen.getByLabelText('My next action (required)'),
      'Meet three founders',
    );
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save focus' }));
    expect(screen.getByRole('alert').props.children).toMatch(/could not be saved/);
    expect(screen.getByLabelText('My next action (required)').props.value).toBe(
      'Meet three founders',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save focus' }));
    expect(screen.getByText('Meet three founders')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Set your weekly focus/ }));
    await fireEvent.changeText(screen.getByLabelText('My next action (required)'), 'Discard this');
    await fireEvent.press(screen.getByRole('button', { name: 'Close details' }));
    expect(useMember.getState().data.member.focusNote).toBe('Meet three founders');
    expect(screen.queryByLabelText('My next action (required)')).toBeNull();
  });
  it('retains the answer review link in Profile', async () => {
    mockParams = { view: 'profile' };
    const screen = await render(<HomeScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'View my direction' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding',
      params: { step: 'complete', from: 'home' },
    });
  });
});
