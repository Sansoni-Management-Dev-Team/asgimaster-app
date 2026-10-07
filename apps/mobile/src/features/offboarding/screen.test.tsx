import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { OffboardingScreen } from './screen';
import { useMember } from '../home/store';
import { useSupport, useSupportUI } from '../support/store';
import { createSupportState } from '../support/model';
import { emptyDraft, startOffboarding } from './model';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams: { request?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
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
  useMember.setState({ ...useMember.getInitialState(), status: 'ready' }, true);
  useSupport.setState(
    { ...useSupport.getInitialState(), data: createSupportState(), status: 'ready' },
    true,
  );
  useSupportUI.setState(useSupportUI.getInitialState(), true);
  mockParams = {};
});

describe('Off-boarding journey', () => {
  it('lets the member go back without creating a request or changing membership', async () => {
    const screen = await render(<OffboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/home',
      params: { view: 'membership' },
    });
    expect(useSupport.getState().data.conversations).toHaveLength(0);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('takes the direct-talk path, retains a failed form and submits safely on retry', async () => {
    const screen = await render(<OffboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Talk to someone' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Request a callback' }));
    expect(screen.getByRole('alert').props.children).toContain('country code');
    await fireEvent.changeText(screen.getByLabelText('Phone number (required)'), '+61 400 000 000');
    await fireEvent.changeText(
      screen.getByLabelText('Preferred time / timezone (optional)'),
      'Weekdays, Sydney time',
    );
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full'));
    await fireEvent.press(screen.getByRole('button', { name: 'Request a callback' }));
    expect(
      await screen.findByText(
        'Your request could not be saved. Your details are still here. Try again.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Phone number (required)').props.value).toBe('+61 400 000 000');
    expect(useSupport.getState().data.conversations).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Request a callback' }));
    expect(await screen.findByRole('header', { name: 'Your callback request.' })).toBeTruthy();
    expect(
      screen.getByText(
        'Prototype only. No team member has been contacted and no real callback has been arranged.',
      ),
    ).toBeTruthy();
    expect(useSupport.getState().data.conversations[0].offboarding?.intent).toBe('discuss');
    await fireEvent.press(screen.getByRole('button', { name: 'View request in Support' }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/home',
      params: { view: 'support', id: useSupport.getState().data.conversations[0].id },
    });
  });
  it.each([
    ['Explore digital access', 'digital-access'],
    ['Continue leaving', 'leave-programme'],
  ] as [string, 'digital-access' | 'leave-programme'][])(
    'supports %s after an optional reason and preserves answers when going back',
    async (action, intent) => {
      const screen = await render(<OffboardingScreen />, { wrapper });
      await fireEvent.press(screen.getByRole('button', { name: 'Continue with leaving' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cost' }));
      await fireEvent.changeText(
        screen.getByLabelText('Anything you’d like to add? (optional)'),
        'Budget changed',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByLabelText('Anything you’d like to add? (optional)').props.value).toBe(
        'Budget changed',
      );
      expect(screen.getByRole('button', { name: 'Cost' }).props.accessibilityState.selected).toBe(
        true,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
      await fireEvent.press(screen.getByRole('button', { name: action }));
      await fireEvent.changeText(
        screen.getByLabelText('Phone number (required)'),
        '+61 400 000 000',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Request a callback' }));
      expect(await screen.findByRole('header', { name: 'Your callback request.' })).toBeTruthy();
      expect(useSupport.getState().data.conversations[0].offboarding).toMatchObject({
        intent,
        reason: 'cost',
        note: 'Budget changed',
      });
    },
  );
  it('allows skipping the reason, and declining digital access goes directly to the callback', async () => {
    const screen = await render(<OffboardingScreen />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with leaving' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue leaving' }));
    expect(screen.getByLabelText('Phone number (required)')).toBeTruthy();
    expect(screen.queryByText('What you’ve shared')).toBeNull();
  });
  it('re-enters an outstanding request at its receipt without repeating retention screens', async () => {
    const data = createSupportState();
    startOffboarding(
      data,
      { ...emptyDraft(), phone: '+61400000000' },
      { plan: 'Growth', status: 'active', cardCode: 'A1B2C3D4E5F6' },
    );
    useSupport.setState({ data });
    const screen = await render(<OffboardingScreen />, { wrapper });
    expect(screen.getByRole('header', { name: 'Your callback request.' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Talk to someone' })).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('handles a missing request link without creating a new request', async () => {
    mockParams = { request: 'missing-request' };
    const screen = await render(<OffboardingScreen />, { wrapper });
    expect(screen.getByRole('header', { name: 'Request not found.' })).toBeTruthy();
    expect(useSupport.getState().data.conversations).toHaveLength(0);
  });
});
