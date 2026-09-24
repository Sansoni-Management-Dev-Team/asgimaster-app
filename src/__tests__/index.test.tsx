import type { ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import Index from '../app/index';
import SignIn from '../app/sign-in';
import { useOnboarding } from '../features/onboarding/store';
import { type OnboardingRecord } from '../features/onboarding/model';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockRedirect = jest.fn((props: unknown) => null);
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
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
  useOnboarding.setState({ ...useOnboarding.getInitialState(), hydration: 'ready' }, true);
});
describe('Native member entry', () => {
  it('opens Home for a completed returning member', async () => {
    const record: OnboardingRecord = {
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
    useOnboarding.setState({ record });
    await render(<Index />, { wrapper });
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/home' });
  });
  it('resumes an unfinished onboarding instead of starting the invitation again', async () => {
    useOnboarding.setState({
      record: { version: 1, answers: { ownershipIntent: 'find-business' } },
    });
    await render(<Index />, { wrapper });
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/onboarding' });
  });
  it('offers both entry actions with accessible names and routes to sign-in', async () => {
    const screen = await render(<Index />, { wrapper });
    expect(screen.getByRole('header', { name: 'You’re invited' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept invitation' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Already a member? Sign in' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');
  });

  it('rejects missing and incomplete emails, then allows a demo without claiming delivery', async () => {
    const screen = await render(<SignIn />, { wrapper });
    const submit = screen.getByRole('button', { name: 'Preview sign-in' });
    await fireEvent.press(submit);
    expect(screen.getByRole('alert').props.children).toBe(
      'Enter the email address from your invitation.',
    );
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'not-an-email');
    await fireEvent.press(submit);
    expect(screen.getByRole('alert').props.children).toContain('complete email address');
    await fireEvent.changeText(screen.getByLabelText('Email address'), ' member@example.com ');
    await fireEvent.press(submit);
    expect(screen.getByRole('header', { name: 'Preview complete' })).toBeTruthy();
    expect(screen.getByText(/No email was sent/)).toBeTruthy();
    expect(screen.queryByLabelText('Email address')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email address').props.value).toBe('member@example.com');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('supports the keyboard submit action and returning to the invitation', async () => {
    const screen = await render(<SignIn />, { wrapper });
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'member@example.com');
    await fireEvent(screen.getByLabelText('Email address'), 'submitEditing');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to invitation' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('provides a way back when sign-in is opened directly', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    const screen = await render(<SignIn />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to invitation' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
