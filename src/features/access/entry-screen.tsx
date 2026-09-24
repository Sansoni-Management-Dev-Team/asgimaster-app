import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { isComplete, resumeStep } from '@/features/onboarding/model';
import { ProgressLoading } from '@/features/onboarding/progress-loading';
import { useOnboarding } from '@/features/onboarding/store';
import { InvitationScreen } from './invitation-screen';

export function EntryScreen() {
  const { record, hydration, hydrate } = useOnboarding();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (hydration !== 'ready') return <ProgressLoading />;
  if (isComplete(record)) return <Redirect href="/home" />;
  if (resumeStep(record) !== 'welcome') return <Redirect href="/onboarding" />;
  return <InvitationScreen />;
}
