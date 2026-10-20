import { backendConfigured } from '@/lib/api-config';
import { MemberOnboardingScreen } from '@/features/session/onboarding-screen';
import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';
export default function OnboardingRoute() {
  return backendConfigured ? <MemberOnboardingScreen /> : <OnboardingScreen />;
}
