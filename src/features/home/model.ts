// Port of app/home-model.js. Catalogue, access, ranking and progress rules stay shared in meaning.
export type Lesson = {
  id: string;
  title: string;
  course: string;
  minutes: number;
  access: string;
  tags: string[];
  takeaway: string;
};
export const lessons: Lesson[] = [
  {
    id: 'direction',
    title: 'Find your direction',
    course: 'Your foundations',
    minutes: 12,
    access: 'foundation',
    tags: ['focus', 'clarity', 'goal'],
    takeaway: 'Write down the one result that would make the biggest difference to your business.',
  },
  {
    id: 'priorities',
    title: 'Choose your priorities',
    course: 'Your foundations',
    minutes: 18,
    access: 'foundation',
    tags: ['priorities', 'focus', 'strategy'],
    takeaway: 'Choose three priorities. Give each one a clear owner and a first action.',
  },
  {
    id: 'blueprint',
    title: 'Your growth blueprint',
    course: 'Growth foundations',
    minutes: 16,
    access: 'growth',
    tags: ['growth', 'business', 'strategy'],
    takeaway: 'Connect each growth priority to one measurable result and a weekly action.',
  },
  {
    id: 'rhythm',
    title: 'Build your weekly rhythm',
    course: 'Your foundations',
    minutes: 9,
    access: 'foundation',
    tags: ['weekly', 'focus', 'action'],
    takeaway: 'Protect a weekly block to act on your priorities and review what moved forward.',
  },
  {
    id: 'delegate',
    title: 'Delegate with confidence',
    course: 'Lead with clarity',
    minutes: 14,
    access: 'growth',
    tags: ['lead', 'team', 'delegate', 'ownership'],
    takeaway: 'Give one responsibility a clear owner, an expected outcome, and a check-in.',
  },
  {
    id: 'review',
    title: 'Review what matters',
    course: 'Growth foundations',
    minutes: 11,
    access: 'growth',
    tags: ['review', 'progress', 'growth'],
    takeaway: 'Compare progress with your goal and choose one adjustment for the coming week.',
  },
];
export const memberships = {
  growth: {
    name: 'Growth',
    status: 'active',
    access: ['foundation', 'growth'],
    ai: true,
    coach: true,
  },
  essentials: {
    name: 'Essentials',
    status: 'active',
    access: ['foundation'],
    ai: true,
    coach: false,
  },
  payment: {
    name: 'Growth',
    status: 'payment_due',
    access: ['foundation', 'growth'],
    ai: true,
    coach: true,
  },
  paused: { name: 'Paused', status: 'paused', access: ['foundation'], ai: false, coach: false },
} as const;
export type Membership = keyof typeof memberships;
export type Goal = { name: string; success: string; weeks: string; context?: string };
export const consultationGoal: Goal = {
  name: 'Grow with focus',
  success: 'Define three growth priorities and turn them into a weekly action plan.',
  weeks: '12',
};
export type Member = {
  firstName: string;
  initials: string;
  membership: Membership;
  positions: Record<string, number>;
  completed: string[];
  weeklyCompleted: string[];
  weeklyMinutes: number;
  focusDone: boolean;
  reflectionDone: boolean;
  focusNote: string;
  reflectionNote: string;
};
export function createMember(fresh = false, membership: Membership = 'growth'): Member {
  return {
    firstName: fresh ? '' : 'Shan',
    initials: fresh ? 'M' : 'SY',
    membership,
    positions: fresh ? {} : { direction: 720, priorities: 1080, blueprint: 480 },
    completed: fresh ? [] : ['direction', 'priorities'],
    weeklyCompleted: fresh ? [] : ['priorities'],
    weeklyMinutes: fresh ? 0 : 26,
    focusDone: false,
    reflectionDone: false,
    focusNote: '',
    reflectionNote: '',
  };
}
export const membershipFor = (member: Member) => memberships[member.membership];
export const canWatch = (member: Member, lesson: Lesson) =>
  (membershipFor(member).access as readonly string[]).includes(lesson.access);
export function getDashboard(member: Member, goal: Goal) {
  const membership = membershipFor(member);
  const entitled = lessons.filter((lesson) => canWatch(member, lesson));
  const complete = entitled.filter((lesson) => member.completed.includes(lesson.id));
  const incomplete = entitled.filter((lesson) => !member.completed.includes(lesson.id));
  const words = `${goal.name} ${goal.success} ${goal.context ?? ''}`.toLowerCase();
  const score = (lesson: Lesson) =>
    lesson.tags.reduce((sum, tag) => sum + Number(words.includes(tag)), 0);
  const ranked = [...incomplete].sort((a, b) => score(b) - score(a));
  const resume = incomplete
    .filter((lesson) => (member.positions[lesson.id] || 0) > 0)
    .sort(
      (a, b) =>
        (member.positions[b.id] || 0) / b.minutes - (member.positions[a.id] || 0) / a.minutes,
    )[0];
  const nextLesson = resume || ranked[0];
  const actionsDone =
    Number(member.weeklyCompleted.length > 0) +
    Number(member.focusDone) +
    Number(member.reflectionDone);
  const next = nextLesson
    ? {
        kind: 'lesson',
        label: resume ? 'Continue learning' : 'Start learning',
        title: resume ? 'Pick up where you left off' : 'Your next step starts here',
        detail: resume
          ? `${Math.max(1, Math.ceil((nextLesson.minutes * 60 - (member.positions[nextLesson.id] || 0)) / 60))} minutes left in ${nextLesson.title.toLowerCase()}.`
          : `${nextLesson.title}. Chosen for your goal.`,
      }
    : !member.focusDone
      ? {
          kind: 'focus',
          label: 'Set my weekly focus',
          title: 'Put your learning to work',
          detail: 'Choose one action that brings your goal closer.',
        }
      : !member.reflectionDone
        ? {
            kind: 'reflection',
            label: 'Review my week',
            title: 'Make your progress count',
            detail: 'Reflect on what worked and decide what comes next.',
          }
        : {
            kind: 'progress',
            label: 'View my progress',
            title: "You're up to date",
            detail:
              "Your included lessons and weekly actions are complete. Take a moment to see how far you've come.",
          };
  return {
    membership,
    entitled,
    complete,
    incomplete,
    resume,
    nextLesson,
    next,
    recommendations: ranked.filter((lesson) => lesson.id !== nextLesson?.id).slice(0, 2),
    coursePercent: Math.round((complete.length / entitled.length) * 100),
    weeklyMinutes: Math.round(member.weeklyMinutes),
    actionsDone,
  };
}
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function watchedSeconds(previous: number, current: number, wallSeconds: number, rate = 1) {
  const delta = current - previous;
  if (
    ![previous, current, wallSeconds, rate].every(Number.isFinite) ||
    delta <= 0 ||
    wallSeconds <= 0 ||
    wallSeconds > 3 ||
    rate <= 0 ||
    delta > wallSeconds * rate + 0.75
  )
    return 0;
  return Math.min(delta / rate, wallSeconds);
}
