import { startConversation, type SupportState, type Result } from '../support/model';
import {
  intentLabels,
  reasonLabels,
  readOffboarding,
  validPhone,
  type OffboardingDraft,
  type MembershipReference,
} from './metadata';

export const emptyDraft = (): OffboardingDraft => ({
  intent: 'discuss',
  reason: null,
  note: '',
  phone: '',
  preferredTime: '',
});
export const pendingOffboarding = (state: SupportState) =>
  state.conversations.find((item) => item.offboarding && item.status !== 'resolved');

export function callbackErrors(draft: OffboardingDraft) {
  return {
    phone: validPhone(draft.phone)
      ? ''
      : 'Enter a phone number with a country code, such as +61 400 000 000.',
    note: draft.note.length <= 400 ? '' : 'Keep your note to 400 characters or fewer.',
    preferredTime:
      draft.preferredTime.length <= 160
        ? ''
        : 'Keep your preferred time to 160 characters or fewer.',
  };
}

export function startOffboarding(
  state: SupportState,
  draft: OffboardingDraft,
  membership: MembershipReference,
): Result {
  const existing = pendingOffboarding(state);
  if (existing) return { conversation: existing };
  const errors = callbackErrors(draft);
  const error = Object.values(errors).find(Boolean);
  if (error) return { error };
  const metadata = readOffboarding({ ...draft, membership });
  if (!metadata) return { error: 'Check your request details and try again.' };
  const text = [
    `Callback request: ${intentLabels[metadata.intent]}`,
    `Phone: ${metadata.phone}`,
    metadata.preferredTime && `Preferred time / timezone: ${metadata.preferredTime}`,
    metadata.reason && `Reason: ${reasonLabels[metadata.reason]}`,
    metadata.note && `Note: ${metadata.note}`,
    `Current programme: ${membership.plan}`,
    'Prototype only. No real callback has been arranged. Membership and access are unchanged.',
  ]
    .filter(Boolean)
    .join('\n');
  const result = startConversation(state, { topic: 'account', text });
  if (result.conversation) result.conversation.offboarding = metadata;
  return result;
}
