import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery as mockUseQuery } from '@tanstack/react-query';
import { Animated } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { MemberOnboardingScreen } from './onboarding-screen';
import type { OnboardingRecord } from '@mlai-sansoni/contracts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('@/features/onboarding/invitation-welcome', () => ({ InvitationWelcome: () => null }));
jest.mock('@/features/onboarding/use-motion', () => ({
  useMotion: () => ({ ready: true, active: true, reduced: true }),
}));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
const mockParams = { step: 'industry' };
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useNavigation: () => ({
    isFocused: () => true,
    getState: () => ({ index: 0, routes: [] }),
    reset: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));
const mockSave = jest.fn<(record: OnboardingRecord, key: string) => Promise<OnboardingRecord>>();
const mockMember = {
  member: { id: 'member-a', displayName: 'Ada', email: 'ada@example.test' },
  access: { state: 'none' },
  onboarding: { version: 1, answers: { ownershipIntent: 'find-business' } },
};
jest.mock('./session-provider', () => ({
  useSessionController: () => ({ saveOnboarding: mockSave }),
  useMemberProfile: () =>
    mockUseQuery({ queryKey: ['member-a'], queryFn: async () => mockMember, staleTime: Infinity }),
  SessionStatus: () => null,
}));
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, right: 0, bottom: 20, left: 0 }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SafeAreaInsetsContext.Provider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(['member-a'], mockMember);
  const timing = Animated.timing;
  jest
    .spyOn(Animated, 'timing')
    .mockImplementation((value, config) => timing(value, { ...config, useNativeDriver: false }));
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});
it('keeps the visible draft after a failed server save and only advances after the idempotent retry succeeds', async () => {
  mockSave
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(async (record) => record);
  const screen = await render(<MemberOnboardingScreen />, { wrapper });
  const field = screen.getByLabelText('Other industry');
  await fireEvent.changeText(field, 'Space travel');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText(/Your answer could not be saved/)).toBeTruthy();
  expect(screen.getByLabelText('Other industry').props.value).toBe('Space travel');
  expect(mockRouter.push).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await act(async () => {
    jest.advanceTimersByTime(700);
  });
  expect(mockRouter.push).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: '/onboarding',
      params: expect.objectContaining({ step: 'role' }),
    }),
  );
  expect(mockSave.mock.calls[0][1]).toBe(mockSave.mock.calls[1][1]);
  expect(mockSave.mock.calls[1][0]).toMatchObject({
    name: 'Ada',
    answers: { industry: 'Space travel' },
  });
});
