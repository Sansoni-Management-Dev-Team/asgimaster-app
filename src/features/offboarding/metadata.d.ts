export type OffboardingIntent = 'discuss' | 'digital-access' | 'leave-programme';
export type OffboardingReason = 'cost' | 'time' | 'unused' | 'changed' | 'achieved' | 'other';
export type MembershipReference = { plan: string; status: string; cardCode: string };
export type OffboardingMetadata = {
  intent: OffboardingIntent;
  reason: OffboardingReason | null;
  note: string;
  phone: string;
  preferredTime: string;
  membership: MembershipReference;
};
export type OffboardingDraft = Omit<OffboardingMetadata, 'membership'>;
export const intentLabels: Record<OffboardingIntent, string>;
export const reasonLabels: Record<OffboardingReason, string>;
export function normalisePhone(value: string): string;
export function validPhone(value: string): boolean;
export function readOffboarding(value: unknown): OffboardingMetadata | undefined;
