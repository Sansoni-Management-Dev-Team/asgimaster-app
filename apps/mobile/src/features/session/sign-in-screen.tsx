import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { TextInput } from 'react-native';
import { loadNativeAuthClient } from './auth-loader';
import { AppButton } from '@/components/app-button';
import { AppField } from '@/components/app-field';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useSessionController, useSessionState } from './session-provider';

export function MemberSignInScreen() {
  const session = useSessionController();
  const sessionState = useSessionState();
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [otp, setOTP] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function act(kind: 'code' | 'magic' | 'verify') {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter your invitation email address.');
      return;
    }
    if (kind === 'verify' && !/^\d{6}$/.test(otp.trim())) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { createNativeAuthClient } = await loadNativeAuthClient();
      const auth = createNativeAuthClient(session);
      if (kind === 'verify') {
        await session.beginSignIn();
        const result = await auth.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
        if (result.error)
          throw new Error(
            'The code could not be verified. Check your code or request another one.',
          );
        await session.finishSignIn();
        router.replace('/home');
      } else if (kind === 'magic') {
        const result = await auth.signIn.magicLink({
          email: email.trim(),
          callbackURL: 'mlaisansoni://auth-callback',
        });
        if (result.error) throw new Error('The link could not be requested. Please try again.');
        setNotice(
          'If this email has member access, a sign-in link will arrive shortly. Open it on this device.',
        );
      } else {
        const result = await auth.emailOtp.sendVerificationOtp({
          email: email.trim(),
          type: 'sign-in',
        });
        if (result.error) throw new Error('The code could not be requested. Please try again.');
        setSent(true);
        setNotice('If this email has member access, a sign-in code will arrive shortly.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppScreen
      title="Sign in"
      actions={
        <>
          <AppButton
            testID="member-auth-submit"
            label={busy ? 'Please wait…' : sent ? 'Verify code' : 'Send email code'}
            disabled={busy}
            onPress={() => void act(sent ? 'verify' : 'code')}
          />
          {sent && (
            <AppButton
              label="Send another code"
              variant="secondary"
              disabled={busy}
              onPress={() => void act('code')}
            />
          )}
          <AppButton
            label="Email me a sign-in link"
            variant="secondary"
            disabled={busy}
            onPress={() => void act('magic')}
          />
        </>
      }
    >
      <AppText variant="eyebrow">Member access</AppText>
      <AppText variant="title">Sign in</AppText>
      <AppText variant="muted">Use the email address associated with your invitation.</AppText>
      <AppField
        nativeID="member-email"
        testID="member-email"
        inputRef={input}
        label="Email address"
        value={email}
        editable={!busy}
        onChangeText={(value) => {
          setEmail(value);
          setSent(false);
          setOTP('');
        }}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {sent && (
        <AppField
          nativeID="member-otp"
          testID="member-otp"
          label="Email code"
          value={otp}
          editable={!busy}
          onChangeText={setOTP}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          onSubmitEditing={() => void act('verify')}
        />
      )}
      {!!notice && (
        <AppText role="status" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      )}
      {!!error && <AppText role="alert">{error}</AppText>}
      {!!sessionState.error && <AppText role="alert">{sessionState.error}</AppText>}
      {sessionState.status === 'error' && (
        <AppButton label="Retry loading member profile" onPress={() => void session.hydrate()} />
      )}
      {sessionState.status === 'signed-out' && !!sessionState.error && (
        <AppButton
          label="Retry clearing this device"
          onPress={() => void session.retryLocalCleanup()}
        />
      )}
    </AppScreen>
  );
}
