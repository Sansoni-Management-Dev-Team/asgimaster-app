import { canWatch, lessons } from "./home-model.js";
import { libraryCatalogue } from "./library-model.js";

export const PROGRESS_KEY = "master-app.learning.v1";
export const formatTime = seconds => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

export function playerContext(member, id) {
  const lesson = libraryCatalogue.find(item => item.id === id);
  if (!lesson) return { state: "missing", lesson: null, queue: [] };
  if (!canWatch(member, lesson)) return { state: "locked", lesson, queue: [] };
  if (lesson.available === false || !lessons.some(item => item.id === id)) return { state: "unavailable", lesson, queue: [] };
  const queue = libraryCatalogue.filter(item => item.collection === lesson.collection && item.available !== false && canWatch(member, item) && lessons.some(known => known.id === item.id));
  const index = queue.findIndex(item => item.id === id);
  return { state: "ready", lesson, queue, index, previous: queue[index - 1], next: queue[index + 1] };
}

export function resumePosition(position, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const safe = Math.max(0, Math.min(duration, Number(position) || 0));
  // A finished video opens ready to replay, not stranded on its final frame.
  return safe >= duration - 0.25 ? 0 : safe;
}

// Count real playback only. A seek, long background gap, or backwards jump adds no minutes.
export function watchedSeconds(previous, current, wallSeconds, rate = 1) {
  const delta = current - previous;
  if (![previous, current, wallSeconds, rate].every(Number.isFinite) || delta <= 0 || wallSeconds <= 0 || wallSeconds > 3 || rate <= 0 || delta > wallSeconds * rate + 0.75) return 0;
  return Math.min(delta / rate, wallSeconds);
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function cleanProgress(value) {
  if (!value || value.version !== 1 || !value.positions || !Array.isArray(value.completed)) return null;
  const ids = new Set(lessons.map(item => item.id));
  const list = input => [...new Set(Array.isArray(input) ? input.filter(id => ids.has(id)) : [])];
  const positions = {};
  for (const lesson of lessons) {
    const position = value.positions[lesson.id];
    if (typeof position === "number" && Number.isFinite(position)) positions[lesson.id] = Math.max(0, Math.min(lesson.minutes * 60, position));
  }
  return { positions, completed: list(value.completed), weeklyCompleted: list(value.weeklyCompleted), weeklyMinutes: Number.isFinite(value.weeklyMinutes) ? Math.max(0, Math.min(10080, value.weeklyMinutes)) : 0 };
}

export function restoreProgress(member, storage = browserStorage()) {
  try {
    const progress = cleanProgress(JSON.parse(storage?.getItem(PROGRESS_KEY) || "null"));
    if (progress) Object.assign(member, progress);
  } catch { /* Invalid or blocked browser storage must never block learning. */ }
  return member;
}

export function persistProgress(member, storage = browserStorage()) {
  try {
    if (!storage) return false;
    // No email, consultation notes, membership claims, or support messages are persisted.
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, positions: member.positions, completed: member.completed, weeklyCompleted: member.weeklyCompleted, weeklyMinutes: member.weeklyMinutes }));
    return true;
  } catch { return false; }
}
