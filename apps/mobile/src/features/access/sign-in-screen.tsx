import { useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppField } from '@/components/app-field';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';

export function SignInScreen() {
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [previewed, setPreviewed] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  function preview() {
    const value = email.trim();
    const message = !value
      ? 'Enter the email address from your invitation.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? 'Enter a complete email address, such as name@example.com.'
        : '';
    setError(message);
    if (message) {
      input.current?.focus();
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
      return;
    }
    Keyboard.dismiss();
    setEmail(value);
    setPreviewed(true);
    if (Platform.OS !== 'web')
      AccessibilityInfo.announceForAccessibility('Preview complete. No email was sent.');
  }
  if (previewed)
    return (
      <AppScreen
        title="Preview complete"
        actions={
          <>
            <AppButton
              label="Continue to onboarding"
              onPress={() => router.replace('/onboarding')}
            />
            <AppButton label="Use a different email" onPress={() => setPreviewed(false)} />
            <AppButton
              label="Back to invitation"
              variant="secondary"
              onPress={() => router.replace('/')}
            />
          </>
        }
      >
        <AppText variant="eyebrow">Member access</AppText>
        <AppText variant="title">Preview complete</AppText>
        <AppText accessibilityLiveRegion="polite" role="status">
          No email was sent. This is a demonstration of the sign-in experience.
        </AppText>
        <AppText variant="muted">
          In the full experience, you’ll receive a secure link to sign in without a password.
        </AppText>
      </AppScreen>
    );
  return (
    <AppScreen
      title="Sign in"
      actions={
        <>
          <AppText variant="muted">Demo only. Your email is not sent or saved.</AppText>
          <AppButton label="Preview sign-in" onPress={preview} />
        </>
      }
    >
      <AppButton
        label="Back to invitation"
        variant="secondary"
        onPress={back}
        style={{ alignSelf: 'flex-start' }}
      />
      <AppText variant="eyebrow">Member access</AppText>
      <AppText variant="title">Sign in</AppText>
      <AppText variant="muted">Enter your invitation email.</AppText>
      <AppField
        nativeID="invitation-email"
        inputRef={input}
        label="Email address"
        hint="Use the email address associated with your invitation."
        error={error}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError('');
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={preview}
      />
    </AppScreen>
  );
}
