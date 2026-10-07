// Home's event catalogue and eligibility come from app/events-model.js.
import { membershipFor, type Member } from './model';
export type MemberEvent = {
  id: string;
  title: string;
  format: string;
  access: string;
  offset: number;
  hours: number;
  location: string;
  host: string;
  description: string;
  preparation: string;
  status?: string;
  lessonIds: string[];
  start: number;
  end: number;
};
const templates = [
  {
    id: 'focus',
    title: 'Focus into action',
    format: 'in-person',
    access: 'growth',
    offset: 2,
    hours: 5,
    location: 'Harbour Studio · Sydney',
    host: 'Alex Morgan',
    lessonIds: ['priorities', 'blueprint'],
    description: 'A working session to turn your priorities into a practical weekly plan.',
    preparation: 'Bring your three priorities and one business decision you want to move forward.',
  },
  {
    id: 'leadership',
    title: 'Leadership live',
    format: 'online',
    access: 'foundation',
    offset: 7,
    hours: 1,
    location: 'Online · demo meeting',
    host: 'Jamie Lee',
    lessonIds: ['direction', 'delegate'],
    description: 'Work through a leadership challenge with other members and a facilitator.',
    preparation: 'Watch your included preparation lesson and bring one question.',
  },
  {
    id: 'team',
    title: 'Build a stronger team',
    format: 'in-person',
    access: 'growth',
    offset: 14,
    hours: 4,
    location: 'Garden Rooms · Melbourne',
    host: 'Taylor Quinn',
    lessonIds: ['delegate'],
    status: 'full',
    description: "Clarify ownership and make your team's next steps practical.",
    preparation: 'Bring a responsibility you are ready to delegate.',
  },
  {
    id: 'strategy',
    title: 'Strategy roundtable',
    format: 'in-person',
    access: 'master',
    offset: 21,
    hours: 3,
    location: 'City Studio · Sydney',
    host: 'Casey Jordan',
    lessonIds: ['blueprint'],
    description: 'A facilitated strategy discussion.',
    preparation: 'Bring a strategic priority.',
  },
  {
    id: 'weekly',
    title: 'Your weekly rhythm',
    format: 'online',
    access: 'foundation',
    offset: 28,
    hours: 1,
    location: 'Online · demo meeting',
    host: 'Jamie Lee',
    lessonIds: ['rhythm'],
    status: 'cancelled',
    description: 'Make room for consistent weekly action.',
    preparation: 'Bring your weekly plan.',
  },
  {
    id: 'growth',
    title: 'Growth in practice',
    format: 'in-person',
    access: 'growth',
    offset: 35,
    hours: 5,
    location: 'River Studio · Brisbane',
    host: 'Alex Morgan',
    lessonIds: ['blueprint', 'review'],
    description: 'Review what is working and leave with one clear business experiment.',
    preparation: 'Bring a recent result and the question it raises.',
  },
];
export type Registrations = Record<string, 'registered' | 'cancelled'>;
export function eventCatalogue(anchor: string): MemberEvent[] {
  return templates.map((t) => {
    const start = Date.parse(anchor) + t.offset * 86400000;
    return { ...t, id: `${t.id}-${anchor}`, start, end: start + t.hours * 3600000 };
  });
}
export const canAttend = (member: Member, event: MemberEvent) =>
  (membershipFor(member).access as readonly string[]).includes(event.access);
export function eventStatus(event: MemberEvent, registrations: Registrations, now: number) {
  if (event.status === 'cancelled') return 'Cancelled';
  if (event.end <= now) return 'Ended';
  if (registrations[event.id] === 'registered') return 'Registered';
  return event.status === 'full' ? 'Fully booked' : 'Open';
}
export function nextEvent(
  member: Member,
  anchor: string,
  registrations: Registrations,
  now: number,
) {
  const events = eventCatalogue(anchor).filter(
    (e) =>
      canAttend(member, e) && ['Open', 'Registered'].includes(eventStatus(e, registrations, now)),
  );
  return events.find((e) => registrations[e.id] === 'registered') || events[0];
}
export function eventDate(event: MemberEvent, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: event.location.includes('Brisbane') ? 'Australia/Brisbane' : 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(event.start);
}
export function eventTime(event: MemberEvent) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: event.location.includes('Brisbane') ? 'Australia/Brisbane' : 'Australia/Sydney',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(event.start);
}
