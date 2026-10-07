export const intentLabels = {
  discuss: 'Talk through my options',
  'digital-access': 'Explore digital app access',
  'leave-programme': 'Leave my programme',
};
export const reasonLabels = {
  cost: 'Cost',
  time: 'Time',
  unused: 'Not using the programme',
  changed: 'My needs have changed',
  achieved: 'I’ve achieved my goals',
  other: 'Something else',
};
export const normalisePhone = (value) =>
  typeof value === 'string' ? value.replace(/[\s().-]/g, '') : '';
export const validPhone = (value) => /^\+[1-9]\d{7,14}$/.test(normalisePhone(value));

export function readOffboarding(value) {
  if (!value || typeof value !== 'object' || !Object.hasOwn(intentLabels, value.intent)) return;
  if (!validPhone(value.phone)) return;
  if (value.reason !== null && !Object.hasOwn(reasonLabels, value.reason)) return;
  if (typeof value.note !== 'string' || value.note.length > 400) return;
  if (typeof value.preferredTime !== 'string' || value.preferredTime.length > 160) return;
  const membership = value.membership;
  if (
    !membership ||
    !['plan', 'status', 'cardCode'].every(
      (key) =>
        typeof membership[key] === 'string' &&
        membership[key].length > 0 &&
        membership[key].length <= 80,
    )
  )
    return;
  return {
    intent: value.intent,
    reason: value.reason,
    note: value.note.trim(),
    phone: normalisePhone(value.phone),
    preferredTime: value.preferredTime.trim(),
    membership: { plan: membership.plan, status: membership.status, cardCode: membership.cardCode },
  };
}
