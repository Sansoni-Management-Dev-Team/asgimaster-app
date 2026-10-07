import { membershipFor, lessons, canWatch } from '../home/model';

// Presentation-only demo access. A production service must authorize every action.
export const EVENTS_KEY = 'master-app.events.v1';
const DAY = 86400000;
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
const validDay = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  dayKey(Date.parse(value)) === value;
const templates = [
  {
    key: 'focus',
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
    goalNote: 'Put your current goal into practice with a focused action plan.',
  },
  {
    key: 'leadership',
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
    goalNote: 'Choose one leadership action that supports your personal goal.',
  },
  {
    key: 'team',
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
    goalNote: 'Connect team ownership to the outcome in your personal plan.',
  },
  {
    key: 'strategy',
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
    goalNote: 'Review the decisions behind your goal.',
  },
  {
    key: 'weekly',
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
    goalNote: 'Build a weekly routine around your goal.',
  },
  {
    key: 'growth',
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
    goalNote: 'Measure progress against your personal plan and refine your next action.',
  },
  {
    key: 'review',
    title: 'Review and reset',
    format: 'online',
    access: 'foundation',
    offset: -3,
    hours: 1,
    location: 'Online · demo meeting',
    host: 'Taylor Quinn',
    lessonIds: ['review', 'rhythm'],
    description: 'A guided review of the actions that moved your business forward.',
    preparation: 'Bring your weekly notes.',
    goalNote: 'Reflect on progress and choose the next step for your goal.',
  },
];
export function createEventState(now = Date.now()) {
  return { version: 1, anchors: [dayKey(now)], registrations: {} };
}
export function eventCatalogue(state) {
  return state.anchors
    .flatMap((anchor) =>
      templates.map((template) => {
        const start = Date.parse(anchor) + template.offset * DAY;
        return {
          ...template,
          id: `${template.key}-${anchor}`,
          start,
          end: start + template.hours * 3600000,
          timezone: template.location.includes('Brisbane')
            ? 'Australia/Brisbane'
            : 'Australia/Sydney',
          status: template.status || 'open',
          agenda: [
            { minutes: 0, title: 'Welcome and priorities' },
            { minutes: 15, title: 'Guided working session' },
            { minutes: template.hours * 60 - 15, title: 'Your next action' },
          ],
        };
      }),
    )
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}
export const canAttend = (member, event) =>
  Boolean(event && membershipFor(member).access.includes(event.access));
export const relatedLessons = (member, event) =>
  lessons.filter((lesson) => event.lessonIds.includes(lesson.id) && canWatch(member, lesson));
export const registrationFor = (state, id) =>
  Object.hasOwn(state.registrations, id) ? state.registrations[id] : null;
export function eventStatus(member, event, state, now = Date.now()) {
  if (!canAttend(member, event)) return 'unavailable';
  if (event.status === 'cancelled') return 'cancelled';
  const registration = registrationFor(state, event.id);
  if (registration?.status === 'attended') return 'attended';
  if (event.end <= now) return 'ended';
  if (registration?.status === 'registered') return 'registered';
  return event.status === 'full' ? 'full' : 'open';
}
export function selectEvents(
  member,
  state,
  { format = 'all', mine = false, now = Date.now() } = {},
) {
  return eventCatalogue(state).filter(
    (event) =>
      canAttend(member, event) &&
      (format === 'all' || event.format === format) &&
      (mine
        ? ['registered', 'attended'].includes(registrationFor(state, event.id)?.status)
        : event.end > now),
  );
}
export function eventProgress(member, state, now = Date.now()) {
  const mine = selectEvents(member, state, { mine: true, now });
  return {
    upcoming: mine.filter((event) => eventStatus(member, event, state, now) === 'registered'),
    attended: mine.filter((event) => registrationFor(state, event.id)?.status === 'attended'),
  };
}
export function nextEvent(member, state, now = Date.now()) {
  const events = selectEvents(member, state, { now }).filter((event) =>
    ['open', 'registered'].includes(eventStatus(member, event, state, now)),
  );
  return (
    events.find((event) => registrationFor(state, event.id)?.status === 'registered') ||
    events[0] ||
    null
  );
}
export const isEventDay = (event, now = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: event.timezone }).format(now) ===
  new Intl.DateTimeFormat('en-CA', { timeZone: event.timezone }).format(event.start);
export function eventDate(event, options = {}) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: event.timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(event.start);
}
export function eventTime(event, timestamp = event.start) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: event.timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(timestamp);
}
export const eventMonth = (event) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: event.timezone,
    month: 'long',
    year: 'numeric',
  }).format(event.start);
export const ticketLabel = (event) =>
  event.format === 'online' ? 'View online access' : 'View my ticket';
export function registerEvent(member, state, event, now = Date.now()) {
  const status = eventStatus(member, event, state, now);
  if (status === 'registered' || status === 'attended') return { ok: true, changed: false };
  if (status !== 'open') return { ok: false, reason: 'Registration is not available.' };
  const old = registrationFor(state, event.id);
  const revision = (old?.revision || 0) + 1;
  state.registrations[event.id] = {
    status: 'registered',
    registeredAt: now,
    revision,
    passId: `DEMO-${event.id.toUpperCase()}-${revision}`,
    checkedInAt: null,
  };
  return { ok: true, changed: true };
}
export function cancelRegistration(member, state, event) {
  if (!canAttend(member, event)) return { ok: false, reason: 'This event is not available.' };
  const record = registrationFor(state, event.id);
  if (!record || record.status === 'attended')
    return { ok: false, reason: 'This registration cannot be cancelled.' };
  if (record.status === 'cancelled') return { ok: true, changed: false };
  record.status = 'cancelled';
  record.passId = null;
  return { ok: true, changed: true };
}
export function simulateCheckIn(member, state, event, now = Date.now()) {
  const status = eventStatus(member, event, state, now);
  if (status === 'attended') return { ok: true, changed: false };
  if (status !== 'registered') return { ok: false, reason: 'A current registration is required.' };
  const record = registrationFor(state, event.id);
  record.status = 'attended';
  record.checkedInAt = now;
  return { ok: true, changed: true };
}
export function parseEventRoute(hash) {
  const match =
    /^#?events(?:\/(mine|[a-z]+-\d{4}-\d{2}-\d{2})(?:\/(confirmed|ticket|checked-in))?)?$/.exec(
      hash,
    );
  if (!match || (match[1] === 'mine' && match[2])) return { view: 'unavailable' };
  return {
    view: !match[1] || match[1] === 'mine' ? 'list' : match[2] || 'detail',
    id: match[1] === 'mine' ? null : match[1],
    mine: match[1] === 'mine',
  };
}
function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
export function persistEvents(state, target = storage()) {
  try {
    if (!target) return false;
    target.setItem(EVENTS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function loadEvents(target = storage(), now = Date.now()) {
  const state = createEventState(now);
  try {
    const raw = JSON.parse(target?.getItem(EVENTS_KEY) || 'null');
    if (
      raw?.version !== 1 ||
      !Array.isArray(raw.anchors) ||
      !raw.anchors.length ||
      !raw.anchors.every(validDay)
    )
      return state;
    state.anchors = [...new Set(raw.anchors)].sort();
    // Add fresh fixtures after the last cohort has ended; preserve old attendance.
    if (Date.parse(state.anchors.at(-1)) + 36 * DAY < now) state.anchors.push(dayKey(now));
    const known = new Set(eventCatalogue(state).map((event) => event.id));
    for (const [id, record] of Object.entries(raw.registrations || {})) {
      if (
        !known.has(id) ||
        !['registered', 'cancelled', 'attended'].includes(record?.status) ||
        !Number.isFinite(record.registeredAt) ||
        !Number.isSafeInteger(record.revision) ||
        record.revision < 1
      )
        continue;
      if (record.status === 'attended' && !Number.isFinite(record.checkedInAt)) continue;
      state.registrations[id] = {
        status: record.status,
        registeredAt: record.registeredAt,
        revision: record.revision,
        passId:
          record.status === 'cancelled' ? null : `DEMO-${id.toUpperCase()}-${record.revision}`,
        checkedInAt: record.status === 'attended' ? record.checkedInAt : null,
      };
    }
  } catch {
    /* Corrupt or blocked storage never blocks the in-memory demo. */
  }
  return state;
}
