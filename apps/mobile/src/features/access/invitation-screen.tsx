import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

export function InvitationScreen() {
  const router = useRouter();
  return (
    <AppScreen
      title="Invitation"
      actions={
        <>
          <AppButton label="Accept invitation" onPress={() => router.push('/sign-in')} />
          <AppButton
            label="Already a member? Sign in"
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        </>
      }
    >
      <AppText variant="eyebrow">Invitation</AppText>
      <AppText variant="title">You’re invited</AppText>
      <AppText variant="muted">Join Master App to access your private member experience.</AppText>
      <View
        style={{
          gap: theme.space.sm,
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.accent,
          paddingLeft: theme.space.md,
        }}
      >
        <AppText>Private access</AppText>
        <AppText variant="muted">Password-free sign in</AppText>
      </View>
    </AppScreen>
  );
}
