import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeScreen } from './home-screen';
import { useMember } from './store';
import type { Membership } from './model';
import { useOnboarding } from '../onboarding/store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams: { view?: string; preview?: string } = {};
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
  it.each([
    ['growth', '6 lessons · Foundations and growth', 'Your consultant', 'Contact member support'],
    ['essentials', '3 lessons · Foundations', 'Member support', 'Contact member support'],
    ['payment', '6 lessons · Foundations and growth', 'Your consultant', 'Get payment help'],
    ['paused', '3 lessons · Foundations', 'Member support', 'Discuss my membership'],
  ] as [Membership, string, string, string][])(
    'shows accurate access and support for %s membership',
    async (membership, lessons, support, action) => {
      mockParams = { view: 'membership' };
      await useMember.getState().preset(membership, 'current');
      const screen = await render(<HomeScreen />, { wrapper });
      expect(screen.getByText(lessons)).toBeTruthy();
      expect(screen.getByRole('button', { name: support })).toBeTruthy();
      expect(Boolean(screen.queryByRole('button', { name: 'AaronAI guidance' }))).toBe(
        membership !== 'paused',
      );
      await fireEvent.press(screen.getByRole('button', { name: action }));
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/home',
        params: { view: 'support' },
      });
    },
  );
  it('offers a retry when personalisation cannot be saved', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full'));
    const screen = await render(<HomeScreen />, { wrapper });
    expect(screen.getByRole('alert').props.children).toMatch(/could not be saved/);
    expect(screen.queryByRole('button', { name: 'Start learning' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry personalising Home' }));
    expect(screen.getByText('Build a team')).toBeTruthy();
  });
  it('populates Home from onboarding without inventing learning activity', async () => {
    const screen = await render(<HomeScreen />, { wrapper });
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Build a team')).toBeTruthy();
    expect(screen.getByText('Funding')).toBeTruthy();
    expect(screen.getByText('Leadership')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Course: 0 of 6/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Learning: 0 of 60/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start learning' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/home',
      params: { view: 'lesson', id: 'delegate' },
    });
  });
  it('opens an empty Home and lets the member start onboarding', async () => {
    useOnboarding.setState({ record: { version: 1, answers: {} } });
    const screen = await render(<HomeScreen />, { wrapper });
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.queryByText('Picked for you')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Set up my direction' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
  });
  it('resumes partial setup and previews empty Home without clearing saved answers', async () => {
    const record = useOnboarding.getState().record;
    mockParams = { preview: 'empty' };
    const screen = await render(<HomeScreen />, { wrapper });
    expect(screen.getByText('Empty Home preview')).toBeTruthy();
    expect(useOnboarding.getState().record).toEqual(record);
    await fireEvent.press(screen.getByRole('button', { name: 'Show my personalised Home' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
    await screen.unmount();
    mockParams = {};
    useOnboarding.setState({
      record: { version: 1, answers: { ownershipIntent: 'find-business' } },
    });
    const partial = await render(<HomeScreen />, { wrapper });
    expect(partial.getByText('1 of 7 answers saved. Pick up where you left off.')).toBeTruthy();
    await fireEvent.press(partial.getByRole('button', { name: 'Continue setting up' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
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
  it('keeps card descriptions accessible and both membership links working without visible field headings', async () => {
    mockParams = { view: 'profile' };
    useMember.setState({
      data: {
        ...useMember.getState().data,
        membershipCard: { code: '00000123', expiresOn: '2027-09-29' },
      },
    });
    const screen = await render(<HomeScreen />, { wrapper });
    const card = screen.getByRole('button', {
      name: 'View membership details, Growth plan. Membership active. Expires 29 SEPT 2027. Card ID 0000 0123.',
    });
    expect(card.props.accessibilityHint).toBe('Opens your membership details.');
    expect(screen.getByText('29 SEPT 2027')).toBeTruthy();
    expect(screen.getByText('0000 0123')).toBeTruthy();
    expect(screen.queryByText('Expires')).toBeNull();
    expect(screen.queryByText('Card ID')).toBeNull();
    await fireEvent.press(card);
    await fireEvent.press(screen.getByRole('button', { name: 'Membership details' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/home',
      params: { view: 'membership' },
    });
  });
});
