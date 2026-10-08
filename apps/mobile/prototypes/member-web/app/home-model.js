// Local prototype catalogue. Entitlements are presentation rules, not production authorization.
export const lessons = [
  { id: "direction", title: "Find your direction", course: "Your foundations", minutes: 12, access: "foundation", tags: ["focus", "clarity", "goal"], takeaway: "Write down the one result that would make the biggest difference to your business." },
  { id: "priorities", title: "Choose your priorities", course: "Your foundations", minutes: 18, access: "foundation", tags: ["priorities", "focus", "strategy"], takeaway: "Choose three priorities. Give each one a clear owner and a first action." },
  { id: "blueprint", title: "Your growth blueprint", course: "Growth foundations", minutes: 16, access: "growth", tags: ["growth", "business", "strategy"], takeaway: "Connect each growth priority to one measurable result and a weekly action." },
  { id: "rhythm", title: "Build your weekly rhythm", course: "Your foundations", minutes: 9, access: "foundation", tags: ["weekly", "focus", "action"], takeaway: "Protect a weekly block to act on your priorities and review what moved forward." },
  { id: "delegate", title: "Delegate with confidence", course: "Lead with clarity", minutes: 14, access: "growth", tags: ["lead", "team", "delegate", "ownership"], takeaway: "Give one responsibility a clear owner, an expected outcome, and a check-in." },
  { id: "review", title: "Review what matters", course: "Growth foundations", minutes: 11, access: "growth", tags: ["review", "progress", "growth"], takeaway: "Compare progress with your goal and choose one adjustment for the coming week." },
];

export const memberships = {
  growth: { name: "Growth", status: "active", access: ["foundation", "growth"], ai: true, coach: true },
  essentials: { name: "Essentials", status: "active", access: ["foundation"], ai: true, coach: false },
  payment: { name: "Growth", status: "payment_due", access: ["foundation", "growth"], ai: true, coach: true },
  paused: { name: "Paused", status: "paused", access: ["foundation"], ai: false, coach: false },
};

export function createMember({ fresh = false, membership = "growth" } = {}) {
  return {
    firstName: "Shan", initials: "SY", membership,
    positions: fresh ? {} : { direction: 720, priorities: 1080, blueprint: 480 },
    completed: fresh ? [] : ["direction", "priorities"],
    // The sample member completed 'priorities' in the current week.
    weeklyCompleted: fresh ? [] : ["priorities"],
    weeklyMinutes: fresh ? 0 : 26,
    focusDone: false, reflectionDone: false,
  };
}

export function membershipFor(member) {
  return memberships[member.membership] || memberships.essentials;
}

export function canWatch(member, lesson) {
  return Boolean(lesson && membershipFor(member).access.includes(lesson.access));
}

export function getDashboard(member, goal) {
  const membership = membershipFor(member);
  const entitled = lessons.filter(lesson => canWatch(member, lesson));
  const complete = entitled.filter(lesson => member.completed.includes(lesson.id));
  const incomplete = entitled.filter(lesson => !member.completed.includes(lesson.id));
  const goalWords = `${goal.name} ${goal.success}`.toLowerCase();
  const score = lesson => lesson.tags.reduce((sum, tag) => sum + Number(goalWords.includes(tag)), 0);
  const ranked = [...incomplete].sort((a, b) => score(b) - score(a));
  const resume = incomplete.filter(lesson => (member.positions[lesson.id] || 0) > 0)
    .sort((a, b) => (member.positions[b.id] || 0) / (b.minutes * 60) - (member.positions[a.id] || 0) / (a.minutes * 60))[0];
  const nextLesson = resume || ranked[0];
  const recommendations = ranked.filter(lesson => lesson.id !== nextLesson?.id).slice(0, 2);
  const actionsDone = Number(member.weeklyCompleted.length > 0) + Number(member.focusDone) + Number(member.reflectionDone);
  let next;
  if (nextLesson) {
    next = { kind: "lesson", lesson: nextLesson, label: resume ? "Continue learning" : "Start learning", title: resume ? "Pick up where you left off" : "Your next step starts here", detail: resume ? `${Math.max(1, Math.ceil((nextLesson.minutes * 60 - (member.positions[nextLesson.id] || 0)) / 60))} minutes left in ${nextLesson.title.toLowerCase()}.` : `${nextLesson.title}. Chosen for your goal.` };
  } else if (!member.focusDone) {
    next = { kind: "focus", label: "Set my weekly focus", title: "Put your learning to work", detail: "Choose one action that brings your goal closer." };
  } else if (!member.reflectionDone) {
    next = { kind: "reflection", label: "Review my week", title: "Make your progress count", detail: "Reflect on what worked and decide what comes next." };
  } else {
    next = { kind: "progress", label: "View my progress", title: "You're up to date", detail: "Your included lessons and weekly actions are complete. Take a moment to see how far you've come." };
  }
  return {
    membership, entitled, complete, incomplete, resume, nextLesson, recommendations, next,
    coursePercent: Math.round(complete.length / entitled.length * 100),
    weeklyMinutes: Math.round(member.weeklyMinutes), actionsDone,
  };
}

export function recordWatch(member, id, position, elapsed = 0) {
  const lesson = lessons.find(item => item.id === id);
  if (!canWatch(member, lesson)) return false;
  member.positions[id] = Math.max(0, Math.min(lesson.minutes * 60, Number(position) || 0));
  member.weeklyMinutes += Math.max(0, Number(elapsed) || 0) / 60;
  return true;
}

export function completeLesson(member, id) {
  const lesson = lessons.find(item => item.id === id);
  if (!canWatch(member, lesson)) return false;
  if (!member.completed.includes(id)) {
    member.completed.push(id);
    member.weeklyCompleted.push(id);
  }
  member.positions[id] = lesson.minutes * 60;
  return true;
}
