import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useOnboarding } from './store';

export function ProgressLoading() {
  const { hydration, storageError, hydrate } = useOnboarding();
  return (
    <AppScreen
      title="Your saved progress"
      actions={
        hydration === 'failed' && (
          <AppButton label="Retry loading progress" onPress={() => void hydrate()} />
        )
      }
    >
      <AppText variant="title">Your next chapter</AppText>
      <AppText role={hydration === 'failed' ? 'alert' : 'status'} accessibilityLiveRegion="polite">
        {storageError || 'Loading your saved progress…'}
      </AppText>
    </AppScreen>
  );
}
