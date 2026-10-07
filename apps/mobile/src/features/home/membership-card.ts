export type MembershipCard = { code: string; expiresOn: string };

const numericCode = (value: number) => String(value % 100_000_000).padStart(8, '0');

// Local prototype identifiers are display references, never authentication credentials.
export function createMembershipCard(now = new Date()): MembershipCard {
  const random =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ??
    Array.from({ length: 3 }, () =>
      Math.floor(Math.random() * 65536)
        .toString(16)
        .padStart(4, '0'),
    ).join('');
  const year = now.getUTCFullYear() + 1;
  const month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return {
    code: numericCode(Number.parseInt(random, 16)),
    expiresOn: new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10),
  };
}

function validExpiry(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isMembershipCard(value: unknown): value is MembershipCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as Partial<MembershipCard>;
  return typeof card.code === 'string' && /^\d{8}$/.test(card.code) && validExpiry(card.expiresOn);
}

export function readMembershipCard(value: unknown): MembershipCard | null {
  if (isMembershipCard(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const card = value as Partial<MembershipCard>;
  if (
    typeof card.code !== 'string' ||
    !/^[A-F0-9]{12}$/i.test(card.code) ||
    !validExpiry(card.expiresOn)
  )
    return null;
  // The old 12-digit hexadecimal value fits exactly within JavaScript's safe integer range.
  return { code: numericCode(Number.parseInt(card.code, 16)), expiresOn: card.expiresOn };
}

export const formatCardCode = (code: string) => code.match(/.{1,4}/g)?.join(' ') ?? code;
export const formatCardExpiry = (expiresOn: string) =>
  new Date(`${expiresOn}T00:00:00Z`)
    .toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
