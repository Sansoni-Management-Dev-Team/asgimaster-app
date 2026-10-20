import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { AppButton } from '@/components/app-button';
import { MemberHeader } from '@/components/member-header';
import { hasAnswer, isComplete, questions } from '@/features/onboarding/model';
import { theme } from '@/theme';
import { SessionStatus, useMemberProfile, useSessionController } from './session-provider';

export function MemberHomeScreen() {
  const session = useSessionController();
  const profile = useMemberProfile();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  if (!profile.data)
    return (
      <SessionStatus
        message={profile.error?.message ?? 'Loading your member profile…'}
        retry={profile.error ? () => void profile.refetch() : undefined}
      />
    );
  const { member, onboarding } = profile.data;
  const isProfile = params.view === 'profile';
  const count = questions.filter((question) => hasAnswer(onboarding, question)).length;
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      await session.signOut();
    } catch {
      setSignOutError(
        'We could not confirm that your session was revoked. You are still signed in. Please try signing out again.',
      );
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <AppScreen
      title={isProfile ? 'Profile' : 'Today'}
      actions={
        <>
          <AppButton
            testID="member-profile-navigation"
            label={isProfile ? 'Back to Home' : 'Your profile'}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/home', params: { view: isProfile ? 'home' : 'profile' } })
            }
          />
          {isProfile && (
            <AppButton
              testID="member-sign-out"
              label={signingOut ? 'Signing out…' : 'Sign out'}
              disabled={signingOut}
              onPress={() => void signOut()}
            />
          )}
        </>
      }
    >
      <MemberHeader title={isProfile ? 'Profile' : 'Today'} />
      <AppText variant="eyebrow">{isProfile ? 'Your account' : 'Your next chapter'}</AppText>
      <AppText variant="title">
        {isProfile ? 'Your profile' : `Welcome, ${onboarding.name || member.displayName}`}
      </AppText>
      {isProfile && (
        <>
          <AppText>{onboarding.name || member.displayName}</AppText>
          <AppText variant="muted">{member.email}</AppText>
        </>
      )}
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.space.lg,
          gap: theme.space.md,
        }}
      >
        <AppText variant="eyebrow">Your membership</AppText>
        <AppText>Access is being set up</AppText>
        <AppText variant="muted">
          Your account is ready. Your membership access is being set up. You can save your direction
          while we prepare it.
        </AppText>
      </View>
      <AppText variant="eyebrow">Your direction</AppText>
      <AppText>{onboarding.answers.goal12Months || 'Your empire starts with you.'}</AppText>
      <AppText variant="muted">
        {count} of {questions.length} answers saved to your account.
      </AppText>
      <AppButton
        label={
          isComplete(onboarding)
            ? 'View my direction'
            : count
              ? 'Continue setting up'
              : 'Set up my direction'
        }
        onPress={() =>
          router.push(
            isComplete(onboarding)
              ? { pathname: '/onboarding', params: { step: 'complete', from: 'home' } }
              : '/onboarding',
          )
        }
      />
      {!!signOutError && <AppText role="alert">{signOutError}</AppText>}
    </AppScreen>
  );
}
