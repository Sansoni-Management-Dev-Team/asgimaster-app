import { getDashboard, membershipFor, lessons } from '../home/model';
import { cleanAcquisition, cleanUpdates, cleanSummary } from './acquisition';

// Unlimited prompt count in the local prototype; access/readiness checks still apply.
export const COACH_KEY = 'master-app.coach.v1';
export const MESSAGE_LIMIT = 2000;
const id = () =>
  globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const createCoachState = () => ({
  version: 1,
  activeId: null,
  conversations: [],
  waitlisted: false,
});
export const currentConversation = (state) =>
  state.conversations.find((chat) => chat.id === state.activeId);

export function coachAccess(member, mode = 'demo') {
  if (!membershipFor(member).ai) return 'locked';
  return ['demo', 'waitlist', 'unavailable'].includes(mode) ? mode : 'unavailable';
}

export function beginMessage(state, text, member, mode = 'demo', now = new Date()) {
  const access = coachAccess(member, mode);
  const value = String(text || '').trim();
  if (access !== 'demo')
    return {
      error:
        "New messages aren't available right now. Your history and human support are still available.",
    };
  if (!value) return { error: 'Write a question before sending.' };
  if (value.length > MESSAGE_LIMIT)
    return { error: `Keep your message to ${MESSAGE_LIMIT} characters or fewer.` };
  if (
    state.conversations.some((chat) =>
      chat.messages.some((message) => message.status === 'pending'),
    )
  )
    return { error: 'Wait for the current reply, or stop it before sending another message.' };
  let chat = currentConversation(state);
  if (chat && chat.messages.some((message) => message.status === 'failed'))
    return { error: 'Retry or remove the unanswered message before sending another.' };
  if (!chat) {
    chat = {
      id: id(),
      title: value.slice(0, 64),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [],
    };
    state.conversations.unshift(chat);
    state.activeId = chat.id;
  }
  const message = {
    id: id(),
    role: 'user',
    text: value,
    status: 'pending',
    createdAt: now.toISOString(),
  };
  chat.messages.push(message);
  chat.updatedAt = now.toISOString();
  return { chatId: chat.id, messageId: message.id };
}

export function failMessage(state, request, detail = "No reply arrived. Retry when you're ready.") {
  const chat = state.conversations.find((item) => item.id === request?.chatId);
  const message = chat?.messages.find((item) => item.id === request?.messageId);
  if (!message || message.status !== 'pending') return false;
  message.status = 'failed';
  message.failure = detail;
  return true;
}

export function retryMessage(state, messageId, member, mode = 'demo') {
  const chat = currentConversation(state);
  const message = chat?.messages.find((item) => item.id === messageId);
  if (!message || message.status !== 'failed')
    return { error: 'This message is no longer waiting for a reply.' };
  if (coachAccess(member, mode) !== 'demo')
    return { error: "A reply isn't available right now. Your message is still saved." };
  if (state.conversations.some((item) => item.messages.some((entry) => entry.status === 'pending')))
    return { error: 'A reply is already in progress.' };
  message.status = 'pending';
  delete message.failure;
  return { chatId: chat.id, messageId };
}

export function resolveMessage(state, request, reply, member, mode = 'demo', now = new Date()) {
  const chat = state.conversations.find((item) => item.id === request?.chatId);
  const message = chat?.messages.find((item) => item.id === request?.messageId);
  if (!message || message.status !== 'pending') return false;
  if (coachAccess(member, mode) !== 'demo') {
    failMessage(
      state,
      request,
      'Availability changed before the reply arrived. Your message is saved for retry.',
    );
    return false;
  }
  message.status = 'sent';
  chat.messages.push({
    id: id(),
    role: 'assistant',
    text: reply.text,
    lessonId: reply.lessonId || null,
    handoff: Boolean(reply.handoff),
    updates: cleanUpdates(reply.updates),
    summary: cleanSummary(reply.summary),
    createdAt: now.toISOString(),
  });
  if (reply.acquisition && chat.acquisition) chat.acquisition = cleanAcquisition(reply.acquisition);
  chat.updatedAt = now.toISOString();
  return true;
}

export function deleteConversation(state, chatId) {
  const index = state.conversations.findIndex((chat) => chat.id === chatId);
  if (index === -1) return false;
  state.conversations.splice(index, 1);
  if (state.activeId === chatId) state.activeId = null;
  return true;
}

export function buildHandoff(
  chat,
  { team = 'support', note = '', includeConversation = false },
  member,
) {
  return {
    team:
      team === 'consultant' && membershipFor(member).coach ? 'Your consultant' : 'Member support',
    note: String(note).trim().slice(0, MESSAGE_LIMIT),
    transcript:
      includeConversation && chat
        ? chat.messages
            .map(
              (message) =>
                `${message.role === 'user' ? `You${message.status !== 'sent' ? ' (no reply received)' : ''}` : 'AaronAI (demo)'}: ${message.text}`,
            )
            .join('\n\n')
        : '',
  };
}

export function demoReply(question, member, goal) {
  const d = getDashboard(member, goal);
  if (
    /\b(medic\w*|diagnos\w*|suicid\w*|self.harm|legal|lawyer|tax|invest\w*|financial advice|drug\w*)\b/i.test(
      question,
    )
  )
    return {
      text: "That needs support from a qualified professional. AaronAI offers general business learning and planning guidance, not medical, legal or financial advice.\n\nFor immediate danger, contact your local emergency service. Member support can help with the app or connect you with your consultant, but isn't an emergency service.",
      handoff: true,
    };
  if (
    /\b(human|person|support|consultant|payment|refund|billing|membership|account)\b/i.test(
      question,
    )
  )
    return {
      text: "A person is the right next step for that. I can't change your membership, take payments, or contact your consultant for you.\n\nUse the handoff below to choose a team and review your request. Your conversation is only included if you choose to share it. This prototype doesn't send requests.",
      handoff: true,
    };
  if (!goal.name)
    return {
      text: 'Your direction is still taking shape. Start with one outcome you would like to work towards, then choose a small action you can take this week.\n\nYou can also set up your direction from Home to connect your goal with your learning. This is a sample coaching reply.',
    };
  if (/\b(week|schedule|routine|time|plan)\b/i.test(question))
    return {
      text: `Keep this week focused on “${goal.name}”.\n\n1. Choose one action that supports your goal.\n2. Give it a realistic place in your week.\n3. At your next check-in, review what changed and what needs adjusting.\n\nWhich action feels manageable to start with?`,
    };
  if (/\b(lesson|learn|watch|next|progress)\b/i.test(question))
    return {
      text: d.nextLesson
        ? `You've completed ${d.complete.length} of ${d.entitled.length} included lessons. Your next learning step is “${d.nextLesson.title}”.\n\nOne idea to try: ${d.nextLesson.takeaway}\n\nAfter watching, choose one small way to apply it to “${goal.name}”.`
        : `You've completed all ${d.entitled.length} lessons included in your current access.\n\nChoose one takeaway to put into practice for “${goal.name}”, then discuss the result with your consultant. What would you like to try first?`,
      lessonId: d.nextLesson?.id,
    };
  if (/\b(goal|focus|priorit\w*|overwhelm\w*)\b/i.test(question))
    return {
      text: `Your current goal is “${goal.name}” over ${goal.weeks} weeks.\n\nSuccess looks like: ${goal.success}\n\nList the actions on your mind. Choose the one most closely connected to that outcome, and define a small first step. What would that step be?`,
    };
  return {
    text: `Let's turn that into one useful next step for “${goal.name}”.\n\nWhat outcome would you like this week, and what's getting in the way? Start with one action you can influence, then review it with your consultant.\n\nThis is a sample coaching reply, not an assessment of your situation.`,
  };
}

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
export function saveCoach(state, target = storage()) {
  try {
    if (!target) return false;
    target.setItem(COACH_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadCoach(target = storage(), now = new Date()) {
  const state = createCoachState(now);
  try {
    const raw = JSON.parse(target?.getItem(COACH_KEY) || 'null');
    if (raw?.version !== 1 || !Array.isArray(raw.conversations)) return state;
    // Legacy day/used fields are ignored without deleting any saved conversations.
    state.waitlisted = raw.waitlisted === true;
    const seen = new Set(),
      lessonIds = new Set(lessons.map((lesson) => lesson.id));
    const date = (value) =>
      typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : now.toISOString();
    for (const chat of raw.conversations) {
      if (
        !chat ||
        typeof chat.id !== 'string' ||
        !/^[\w-]{1,100}$/.test(chat.id) ||
        seen.has(chat.id) ||
        !Array.isArray(chat.messages)
      )
        continue;
      seen.add(chat.id);
      const messageIds = new Set();
      const messages = chat.messages
        .filter(
          (message) =>
            message &&
            ['user', 'assistant'].includes(message.role) &&
            typeof message.text === 'string' &&
            typeof message.id === 'string' &&
            /^[\w-]{1,100}$/.test(message.id),
        )
        .flatMap((message) => {
          if (messageIds.has(message.id)) return [];
          messageIds.add(message.id);
          const clean = {
            id: message.id,
            role: message.role,
            text: message.text.slice(0, message.role === 'user' ? MESSAGE_LIMIT : 6000),
            createdAt: date(message.createdAt),
          };
          if (message.role === 'user') {
            clean.status = message.status === 'sent' ? 'sent' : 'failed';
            if (clean.status === 'failed')
              clean.failure =
                message.status === 'pending'
                  ? "The reply was interrupted. Retry when you're ready."
                  : String(message.failure || 'No reply arrived. Try again.').slice(0, 300);
          } else {
            clean.lessonId = lessonIds.has(message.lessonId) ? message.lessonId : null;
            clean.handoff = message.handoff === true;
            clean.updates = cleanUpdates(message.updates);
            clean.summary = cleanSummary(message.summary);
          }
          return [clean];
        });
      const acquisition = cleanAcquisition(chat.acquisition);
      if (!messages.length && !acquisition) continue;
      state.conversations.push({
        id: chat.id,
        title: String(
          chat.title || messages[0]?.text || acquisition?.title || 'Conversation',
        ).slice(0, 64),
        createdAt: date(chat.createdAt),
        updatedAt: date(chat.updatedAt),
        messages,
        ...(acquisition ? { acquisition } : {}),
      });
    }
    state.activeId = state.conversations.some((chat) => chat.id === raw.activeId)
      ? raw.activeId
      : null;
  } catch {
    /* Corrupt or unavailable storage must not prevent a conversation. */
  }
  return state;
}
