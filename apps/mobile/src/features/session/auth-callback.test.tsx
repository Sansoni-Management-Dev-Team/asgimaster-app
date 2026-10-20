import type { ReactNode } from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AuthCallbackScreen } from './auth-callback-screen';
let mockParams: { token?: string; error?: string };
const mockRouter = { replace: jest.fn(), setParams: jest.fn() };
const mockVerify = jest.fn<() => Promise<{ error: null | { message: string } }>>();
const mockSession = { beginSignIn: jest.fn(async () => {}), finishSignIn: jest.fn(async () => {}) };
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('./session-provider', () => ({ useSessionController: () => mockSession }));
jest.mock('./auth-loader', () => ({
  loadNativeAuthClient: async () => ({
    createNativeAuthClient: () => ({ magicLink: { verify: mockVerify } }),
  }),
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 20, left: 0, right: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: 'expired-one-time-token' };
});
it('accepts a new magic link on the same mounted callback screen after an earlier failure', async () => {
  mockVerify
    .mockResolvedValueOnce({ error: { message: 'invalid' } })
    .mockResolvedValueOnce({ error: null });
  const screen = await render(<AuthCallbackScreen />, { wrapper });
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').props.children).toContain('could not be verified');
  expect(mockSession.finishSignIn).not.toHaveBeenCalled();
  mockParams = { token: 'fresh-one-time-token' };
  await screen.rerender(<AuthCallbackScreen />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
  expect(mockVerify).toHaveBeenCalledTimes(2);
  expect(mockSession.finishSignIn).toHaveBeenCalledTimes(1);
  expect(mockRouter.setParams).toHaveBeenCalledWith({ token: undefined });
  expect(screen.queryByText(/one-time-token/)).toBeNull();
});
