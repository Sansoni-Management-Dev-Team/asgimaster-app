import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadNativeAuthClient } from './auth-loader';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useSessionController } from './session-provider';

export function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const session = useSessionController();
  const router = useRouter();
  const lastCredential = useRef<string | undefined>(undefined);
  const attempt = useRef(0);
  const first = useRef(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = params.token;
    const initial = first.current;
    first.current = false;
    if (!token || typeof token !== 'string') {
      if (initial)
        setError('This sign-in link is invalid or expired. Request another code or link.');
      return;
    }
    if (lastCredential.current === token) return;
    lastCredential.current = token;
    const currentAttempt = ++attempt.current;
    // Remove the single-use credential from navigation history immediately.
    router.setParams({ token: undefined });
    setError('');
    void (async () => {
      try {
        if (params.error)
          throw new Error('This sign-in link is invalid or expired. Request another code or link.');
        const { createNativeAuthClient } = await loadNativeAuthClient();
        if (attempt.current !== currentAttempt) return;
        await session.beginSignIn();
        const result = await createNativeAuthClient(session).magicLink.verify({ query: { token } });
        if (result.error)
          throw new Error('This sign-in link could not be verified. Request another code or link.');
        if (attempt.current !== currentAttempt) return;
        await session.finishSignIn();
        if (attempt.current === currentAttempt) router.replace('/home');
      } catch (failure) {
        if (attempt.current === currentAttempt)
          setError(failure instanceof Error ? failure.message : 'Sign-in failed.');
      }
    })();
  }, [params.error, params.token, router, session]);
  return (
    <AppScreen title="Sign in" actions={null}>
      <AppText variant="title">Member access</AppText>
      <AppText role={error ? 'alert' : 'status'}>{error || 'Verifying your sign-in link…'}</AppText>
      {!!error && (
        <AppButton label="Return to sign in" onPress={() => router.replace('/sign-in')} />
      )}
    </AppScreen>
  );
}
