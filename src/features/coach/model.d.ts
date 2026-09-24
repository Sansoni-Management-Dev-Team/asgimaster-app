import type { Member, Goal } from '../home/model';
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'sent' | 'failed';
  failure?: string;
  createdAt: string;
  lessonId?: string | null;
  handoff?: boolean;
};
export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};
export type CoachState = {
  version: number;
  activeId: string | null;
  conversations: Conversation[];
  waitlisted: boolean;
};
export type Request = { chatId: string; messageId: string };
export type Reply = { text: string; lessonId?: string; handoff?: boolean };
export type Handoff = { team: string; note: string; transcript: string };
export const MESSAGE_LIMIT: number;
export const COACH_KEY: string;
export function createCoachState(): CoachState;
export function currentConversation(state: CoachState): Conversation | undefined;
export function coachAccess(
  member: Member,
  mode?: string,
): 'locked' | 'demo' | 'waitlist' | 'unavailable';
export function beginMessage(
  state: CoachState,
  text: string,
  member: Member,
  mode?: string,
  now?: Date,
): Request | { error: string };
export function failMessage(state: CoachState, request: Request, detail?: string): boolean;
export function retryMessage(
  state: CoachState,
  messageId: string,
  member: Member,
  mode?: string,
): Request | { error: string };
export function resolveMessage(
  state: CoachState,
  request: Request,
  reply: Reply,
  member: Member,
  mode?: string,
  now?: Date,
): boolean;
export function deleteConversation(state: CoachState, id: string): boolean;
export function buildHandoff(
  chat: Conversation | undefined,
  options: { team?: string; note?: string; includeConversation?: boolean },
  member: Member,
): Handoff;
export function demoReply(question: string, member: Member, goal: Goal): Reply;
export function loadCoach(
  target: { getItem: (key: string) => string | null },
  now?: Date,
): CoachState;
