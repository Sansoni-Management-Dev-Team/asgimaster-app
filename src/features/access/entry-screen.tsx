import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { ProgressLoading } from '@/features/onboarding/progress-loading';
import { useOnboarding } from '@/features/onboarding/store';

export function EntryScreen() {
  const { hydration, hydrate } = useOnboarding();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (hydration !== 'ready') return <ProgressLoading />;
  return <Redirect href="/home" />;
}
