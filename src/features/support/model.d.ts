export type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  createdAt: string;
};
export type Topic = 'access' | 'account' | 'technical' | 'consultant' | 'general';
export type Conversation = {
  id: string;
  topic: Topic;
  status: 'waiting' | 'replied' | 'resolved';
  unread: boolean;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  context: string;
};
export type SupportState = { version: number; conversations: Conversation[] };
export type Result =
  | { error: string; conversation?: never; message?: never }
  | { conversation: Conversation; message?: Message; error?: never };
export const SUPPORT_KEY: string;
export const MESSAGE_LIMIT: number;
export const MAX_CONVERSATIONS: number;
export const MAX_MESSAGES: number;
export const MAX_CONTEXT: number;
export const topics: Record<Topic, string>;
export const statusLabels: Record<Conversation['status'], string>;
export function createSupportState(): SupportState;
export function validId(id: unknown): boolean;
export function findConversation(state: SupportState, id?: string): Conversation | undefined;
export function listConversations(state: SupportState, history?: boolean): Conversation[];
export function unreadCount(state: SupportState): number;
export function startConversation(
  state: SupportState,
  input: { topic?: string; text?: string; context?: string },
  permissions?: { consultant?: boolean },
  now?: Date,
): Result;
export function sendMessage(state: SupportState, id: string, text: string, now?: Date): Result;
export function agentReply(
  state: SupportState,
  id: string,
  options?: { resolve?: boolean },
  now?: Date,
): Result;
export function markRead(state: SupportState, id: string): boolean;
export function resolveConversation(state: SupportState, id: string, now?: Date): boolean;
export function reopenConversation(state: SupportState, id: string, now?: Date): boolean;
export function loadSupport(
  target: { getItem: (key: string) => string | null },
  now?: Date,
): SupportState;
export function supportLink(id: string): string;
export function parseSupportRoute(hash: string): { view: string; id?: string };
