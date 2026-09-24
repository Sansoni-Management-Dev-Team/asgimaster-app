// Browser-only prototype. No messages, agent events or push notifications leave this device.
export const SUPPORT_KEY = "master-app.support.v1";
export const MESSAGE_LIMIT = 2000;
export const MAX_CONVERSATIONS = 30;
export const MAX_MESSAGES = 150;
export const MAX_CONTEXT = 600000;
export const topics = Object.freeze({ access: "Learning access", account: "Membership & billing", technical: "Technical help", consultant: "Plan & goals", general: "Something else" });
export const statusLabels = Object.freeze({ waiting: "Waiting for agent", replied: "Agent replied", resolved: "Resolved" });
const id = () => globalThis.crypto?.randomUUID?.() || `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const validId = value => typeof value === "string" && /^[\w-]{1,100}$/.test(value) && !["new", "history"].includes(value);
export const createSupportState = () => ({ version: 1, conversations: [] });
export const findConversation = (state, conversationId) => state.conversations.find(item => item.id === conversationId);
export const supportLink = conversationId => validId(conversationId) ? `#support/${conversationId}` : "#support";
export function parseSupportRoute(hash) {
  const match = /^#support(?:\/([^/]+))?$/.exec(hash);
  if (!match) return { view: "missing" };
  if (!match[1]) return { view: "current" };
  if (["new", "history"].includes(match[1])) return { view: match[1] };
  return validId(match[1]) ? { view: "conversation", id: match[1] } : { view: "missing" };
}
export const listConversations = (state, history = false) => state.conversations.filter(item => (item.status === "resolved") === history).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const unreadCount = state => state.conversations.filter(item => item.unread).length;
const textError = text => !String(text || "").trim() ? "Tell us what you need help with." : String(text).length > MESSAGE_LIMIT ? `Keep your message to ${MESSAGE_LIMIT} characters or fewer.` : null;
const addMessage = (conversation, role, text, now, extra = {}) => {
  const message = { id: id(), role, text, createdAt: now.toISOString(), ...extra };
  conversation.messages.push(message); conversation.updatedAt = now.toISOString();
  return message;
};

export function startConversation(state, { topic = "general", text = "", context = "" }, { consultant = false } = {}, now = new Date()) {
  const error = textError(text);
  if (error) return { error };
  if (!Object.hasOwn(topics, topic) || (topic === "consultant" && !consultant)) return { error: "Choose a support topic included in your access." };
  if (state.conversations.length >= MAX_CONVERSATIONS) return { error: "This browser's demo history is full. No new request was created." };
  if (typeof context !== "string" || context.length > MAX_CONTEXT) return { error: "The shared conversation is too long. Start a request without the transcript." };
  const conversation = { id: id(), topic, status: "waiting", unread: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), messages: [], context };
  addMessage(conversation, "user", text.trim(), now);
  state.conversations.unshift(conversation);
  return { conversation };
}

export function sendMessage(state, conversationId, text, now = new Date()) {
  const conversation = findConversation(state, conversationId);
  if (!conversation) return { error: "This conversation is unavailable on this browser." };
  if (conversation.status === "resolved") return { error: "Reopen this conversation before replying." };
  const error = textError(text);
  if (error) return { error };
  if (conversation.messages.length >= MAX_MESSAGES - 3) return { error: "This demo conversation is full. Start a new conversation to continue." };
  const message = addMessage(conversation, "user", text.trim(), now);
  conversation.status = "waiting"; conversation.unread = false;
  return { conversation, message };
}

export function agentReply(state, conversationId, { resolve = false } = {}, now = new Date()) {
  const conversation = findConversation(state, conversationId);
  if (!conversation || conversation.status === "resolved" || conversation.messages.length >= MAX_MESSAGES - 2) return { error: "Choose an open conversation with room for a reply." };
  const text = resolve ? "Thanks for confirming. I'll mark this request as resolved. If you still need help, you can reopen this conversation.\n\nThis is a sample agent reply; no real agent has reviewed your request." : {
    access: "Hi, I'm Alex from Member Care. Which lesson are you trying to open, and what do you see on screen? Please don't share your password.\n\nThis is a sample agent reply. No account or lesson access has been changed.",
    account: "Hi, I'm Alex from Member Care. Is your question about membership access or a payment notice? You can describe the issue without sharing card or bank details.\n\nThis is a sample agent reply. No payment or account action has been taken.",
    technical: "Hi, I'm Alex from Member Care. Which device are you using, and what happened just before the issue? A short description will help us understand the next step.\n\nThis is a sample agent reply; no diagnostics have been run.",
    consultant: "Hi, I'm Alex, your demo consultant contact. Which part of your agreed goal would you like to discuss?\n\nThis is a sample reply. Your actual consultant hasn't been contacted and your plan hasn't changed.",
    general: "Hi, I'm Alex from Member Care. Thanks for explaining. What would a helpful outcome look like for you?\n\nThis is a sample agent reply; no real agent has reviewed your request.",
  }[conversation.topic];
  const message = addMessage(conversation, "agent", text, now);
  conversation.status = resolve ? "resolved" : "replied"; conversation.unread = true;
  return { conversation, message };
}
export function markRead(state, conversationId) {
  const conversation = findConversation(state, conversationId);
  if (!conversation) return false;
  conversation.unread = false; return true;
}
export function resolveConversation(state, conversationId, now = new Date()) {
  const conversation = findConversation(state, conversationId);
  if (!conversation || conversation.status === "resolved" || conversation.messages.length >= MAX_MESSAGES) return false;
  conversation.status = "resolved"; conversation.unread = false;
  addMessage(conversation, "system", "You marked this conversation resolved.", now); return true;
}
export function reopenConversation(state, conversationId, now = new Date()) {
  const conversation = findConversation(state, conversationId);
  if (!conversation || conversation.status !== "resolved" || conversation.messages.length >= MAX_MESSAGES - 3) return false;
  conversation.status = "waiting"; conversation.unread = false;
  addMessage(conversation, "system", "You reopened this conversation. Add a message about what you still need.", now); return true;
}
function storage() { try { return globalThis.localStorage; } catch { return null; } }
export function saveSupport(state, target = storage()) {
  try { if (!target) return false; target.setItem(SUPPORT_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function loadSupport(target = storage(), now = new Date()) {
  const state = createSupportState();
  try {
    const raw = JSON.parse(target?.getItem(SUPPORT_KEY) || "null");
    if (raw?.version !== 1 || !Array.isArray(raw.conversations)) return state;
    const ids = new Set(), messageIds = new Set();
    const date = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : now.toISOString();
    for (const item of raw.conversations.slice(0, MAX_CONVERSATIONS)) {
      if (!item || !validId(item.id) || ids.has(item.id) || !Object.hasOwn(topics, item.topic) || !Object.hasOwn(statusLabels, item.status) || !Array.isArray(item.messages)) continue;
      ids.add(item.id);
      const messages = item.messages.slice(0, MAX_MESSAGES).flatMap(message => {
        if (!message || !validId(message.id) || messageIds.has(message.id) || !["user", "agent", "system"].includes(message.role) || typeof message.text !== "string") return [];
        messageIds.add(message.id);
        return [{ id: message.id, role: message.role, text: message.text.slice(0, MESSAGE_LIMIT), createdAt: date(message.createdAt) }];
      });
      if (!messages.length) continue;
      state.conversations.push({ id: item.id, topic: item.topic, status: item.status, unread: item.unread === true, createdAt: date(item.createdAt), updatedAt: date(item.updatedAt), messages, context: typeof item.context === "string" ? item.context.slice(0, MAX_CONTEXT) : "" });
    }
  } catch { /* The app remains usable with corrupt, missing or denied browser storage. */ }
  return state;
}
