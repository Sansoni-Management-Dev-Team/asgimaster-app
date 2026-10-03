import { useSupport, useSupportUI } from '../support/store';
import { startOffboarding } from './model';
import type { MembershipReference, OffboardingDraft } from './metadata';

export async function submitCallback(draft: OffboardingDraft, membership: MembershipReference) {
  if (useSupportUI.getState().failNext) {
    useSupportUI.setState({ failNext: false });
    return { error: 'This demo save failed. Your details are still here. Try again.' };
  }
  const result = await useSupport
    .getState()
    .commit(
      (data) => startOffboarding(data, draft, membership),
      'Callback request saved locally. No real callback has been arranged.',
    );
  return result.saved ? result.result : { error: result.error };
}
