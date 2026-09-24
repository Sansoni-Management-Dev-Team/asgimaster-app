import type { Member, Lesson } from '../home/model';
export type Registration = {
  status: 'registered' | 'cancelled' | 'attended';
  registeredAt: number;
  revision: number;
  passId: string | null;
  checkedInAt: number | null;
};
export type EventState = {
  version: number;
  anchors: string[];
  registrations: Record<string, Registration>;
};
export type MemberEvent = {
  id: string;
  key: string;
  title: string;
  format: string;
  access: string;
  offset: number;
  hours: number;
  location: string;
  host: string;
  lessonIds: string[];
  description: string;
  preparation: string;
  goalNote: string;
  timezone: string;
  start: number;
  end: number;
  status: string;
  agenda: { minutes: number; title: string }[];
};
export type EventStatus =
  'unavailable' | 'cancelled' | 'attended' | 'ended' | 'registered' | 'full' | 'open';
export const EVENTS_KEY: string;
export function createEventState(now?: number): EventState;
export function eventCatalogue(state: EventState): MemberEvent[];
export function canAttend(member: Member, event?: MemberEvent): boolean;
export function relatedLessons(member: Member, event: MemberEvent): Lesson[];
export function registrationFor(state: EventState, id: string): Registration | null;
export function eventStatus(
  member: Member,
  event: MemberEvent,
  state: EventState,
  now?: number,
): EventStatus;
export function selectEvents(
  member: Member,
  state: EventState,
  options?: { format?: string; mine?: boolean; now?: number },
): MemberEvent[];
export function eventProgress(
  member: Member,
  state: EventState,
  now?: number,
): { upcoming: MemberEvent[]; attended: MemberEvent[] };
export function nextEvent(member: Member, state: EventState, now?: number): MemberEvent | null;
export function isEventDay(event: MemberEvent, now?: number): boolean;
export function eventDate(event: MemberEvent, options?: Intl.DateTimeFormatOptions): string;
export function eventTime(event: MemberEvent, timestamp?: number): string;
export function eventMonth(event: MemberEvent): string;
export function ticketLabel(event: MemberEvent): string;
export function registerEvent(
  member: Member,
  state: EventState,
  event: MemberEvent,
  now?: number,
): { ok: boolean; changed?: boolean; reason?: string };
export function cancelRegistration(
  member: Member,
  state: EventState,
  event: MemberEvent,
): { ok: boolean; changed?: boolean; reason?: string };
export function simulateCheckIn(
  member: Member,
  state: EventState,
  event: MemberEvent,
  now?: number,
): { ok: boolean; changed?: boolean; reason?: string };
export function loadEvents(
  target: { getItem: (key: string) => string | null },
  now?: number,
): EventState;
export function parseEventRoute(hash: string): { view: string; id?: string | null; mine?: boolean };
