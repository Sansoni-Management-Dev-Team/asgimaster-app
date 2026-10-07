import type { CoachState, Conversation, Reply } from './model';

export const stages = [
  ['SCOUTING', 'Find a business'],
  ['PRE_MEET', 'Before the meeting'],
  ['SIZE_UP', 'Get the full picture'],
  ['BUNDLE', 'How to pay for it'],
  ['PITCHED', 'The pitch'],
  ['DISCOVERY', 'Check everything'],
] as const;
export type Stage = (typeof stages)[number][0] | 'DONE' | 'WALKED';
export type Entry = 'searching' | 'has_target';
export const categories = ['Motivation', 'Numbers', 'Operations', 'Legal', 'Strategy'] as const;
export const buyBoxLabels = {
  skills: 'Skills & experience',
  interests: 'Interests',
  connections: 'Who you know',
  research: 'Research',
  exclusions: 'Ruled out',
  target: 'Your target',
} as const;
export type PlanKey = (typeof categories)[number] | keyof typeof buyBoxLabels | 'evidence';
export type Finding = {
  category: (typeof categories)[number];
  text: string;
  status: 'positive' | 'caution' | 'risk' | 'unknown';
  source: string;
};
export type Summary = { title: string; sections: { heading: string; items: string[] }[] };
export type PlanUpdate = { key: PlanKey; label: string; count: number };
export type Acquisition = {
  version: 1;
  entry: Entry;
  stage: Stage;
  example: boolean;
  title: string;
  location: string;
  industry: string;
  askingPrice: string;
  facts: { label: string; value: string }[];
  buyBox: Record<keyof typeof buyBoxLabels, string[]>;
  checklist: { label: string; answered: boolean }[];
  findings: Finding[];
  direction: { headline: string; confidence: string; reason: string } | null;
  strategies: { title: string; detail: string }[];
  progress: { answered: number; total: number };
  unread: number;
};
export const stageLabel = (stage: Stage) =>
  stages.find(([key]) => key === stage)?.[1] ??
  (stage === 'DONE' ? 'Journey complete' : 'Walked away');

export function emptyAcquisition(entry: Entry): Acquisition {
  return {
    version: 1,
    entry,
    stage: entry === 'searching' ? 'SCOUTING' : 'PRE_MEET',
    example: false,
    title: entry === 'searching' ? 'Your business search' : 'Your next business',
    location: '',
    industry: '',
    askingPrice: '',
    facts: [],
    buyBox: {
      skills: [],
      interests: [],
      connections: [],
      research: [],
      exclusions: [],
      target: [],
    },
    checklist: [
      'What does the business do?',
      'Why is the owner selling?',
      'What would owning it do for you?',
      'What do you need to ask at the meeting?',
    ].map((label) => ({ label, answered: false })),
    findings: [],
    direction: null,
    strategies: [],
    progress: { answered: 0, total: 4 },
    unread: 0,
  };
}

const uid = () => `acq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export function startAcquisition(
  state: CoachState,
  entry: Entry,
  acquisition = emptyAcquisition(entry),
): Conversation {
  const now = new Date().toISOString();
  const chat: Conversation = {
    id: uid(),
    title: acquisition.title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    acquisition,
  };
  state.conversations.unshift(chat);
  state.activeId = chat.id;
  return chat;
}

// UI demo: retain what was actually typed, without pretending to analyse a deal.
// Example plans only enter state through an explicit scenario selection.
export function acquisitionReply(question: string, plan: Acquisition): Reply {
  const next = JSON.parse(JSON.stringify(plan)) as Acquisition;
  next.facts.push({ label: 'Your note · not verified', value: question });
  next.facts = next.facts.slice(-30);
  next.unread += 1;
  return {
    text:
      plan.stage === 'SCOUTING'
        ? 'Your note is now in Evidence & Findings. What experience would you like to bring to a business, and what would you prefer to leave behind?'
        : 'Your note is now in Evidence & Findings. What would you want to establish with the owner before taking the next step?',
    acquisition: next,
    updates: [{ key: 'evidence', label: 'Evidence & Findings', count: 1 }],
    handoff: /\b(human|consultant|support|person)\b/i.test(question),
  };
}

export const scenarios = [
  ['SCOUTING', 'Search'],
  ['PRE_MEET', 'Pre-meeting'],
  ['SIZE_UP', 'Assessment'],
  ['BUNDLE', 'Funding'],
  ['DISCOVERY', 'Due diligence'],
  ['DONE', 'Completion'],
  ['WALKED', 'Walked away'],
] as const;

export function scenarioState(stage: Stage): { acquisition: Acquisition; reply: Reply } {
  const searching = stage === 'SCOUTING';
  const plan = emptyAcquisition(searching ? 'searching' : 'has_target');
  plan.stage = stage;
  plan.example = true;
  plan.title = searching ? 'Finding the right fit' : 'Harbour Services';
  plan.location = 'Melbourne';
  plan.industry = 'Commercial services';
  plan.buyBox = {
    skills: ['Team leadership', 'Service operations'],
    interests: ['Recurring service businesses'],
    connections: ['A local business broker'],
    research: ['Exploring commercial services'],
    exclusions: ['Hospitality'],
    target: ['A service business in Melbourne'],
  };
  plan.facts = searching
    ? [
        { label: 'Example experience', value: 'Ten years managing service teams' },
        { label: 'Example location', value: 'Melbourne' },
      ]
    : [
        { label: 'Example business', value: 'Harbour Services · commercial maintenance' },
        { label: 'Example seller', value: 'Owner planning to retire; motivation still to verify' },
      ];
  plan.askingPrice = searching ? '' : '$480,000';
  plan.checklist[0].answered = true;
  plan.checklist[1].answered = true;
  plan.progress = { answered: 2, total: 4 };
  plan.findings = searching
    ? []
    : [
        {
          category: 'Motivation',
          text: 'Owner says they want to retire',
          status: 'caution',
          source: 'Example seller statement · unverified',
        },
        {
          category: 'Numbers',
          text: 'Trading records need checking',
          status: 'unknown',
          source: 'No verified financial records in this example',
        },
        {
          category: 'Operations',
          text: 'Service team already in place',
          status: 'positive',
          source: 'Example listing · not independently checked',
        },
        {
          category: 'Legal',
          text: 'Contract transfer terms unknown',
          status: 'unknown',
          source: 'Professional review outstanding',
        },
        {
          category: 'Strategy',
          text: 'Service operations match buyer experience',
          status: 'positive',
          source: 'Example buyer profile',
        },
      ];
  const later = ['SIZE_UP', 'BUNDLE', 'PITCHED', 'DISCOVERY', 'DONE', 'WALKED'].includes(stage);
  if (later) {
    plan.findings[1] = {
      category: 'Numbers',
      text: 'Customer concentration needs review',
      status: 'caution',
      source: 'Example: one customer contributes 35% of revenue',
    };
    plan.facts.push({ label: 'Example concentration', value: 'Largest customer: 35% of revenue' });
    plan.progress = { answered: 3, total: 5 };
  }
  const descriptions: Record<Stage, [string, string, string]> = {
    SCOUTING: [
      'Keep exploring',
      'Insufficient',
      'Build a picture of the business that fits your experience.',
    ],
    PRE_MEET: [
      'Keep gathering',
      'Insufficient',
      'Meet the owner and establish their motivation before assessing the deal.',
    ],
    SIZE_UP: [
      'Check the concentration',
      'Low',
      'The largest customer is material to this example. Review contract length and renewal terms.',
    ],
    BUNDLE: [
      'Explore the structure',
      'Low',
      'The example funding gap is still open. Terms and affordability need independent review.',
    ],
    PITCHED: [
      'Await the response',
      'Low',
      'Record the seller’s response and any changes to the proposed terms.',
    ],
    DISCOVERY: [
      'Verify the evidence',
      'Moderate',
      'Two checks are complete in this example; contracts and financial records remain open.',
    ],
    DONE: [
      'Journey complete',
      'High',
      'This fictional scenario has completed its review. No real transaction has taken place.',
    ],
    WALKED: [
      'Walk away',
      'Moderate',
      'This fictional deal was closed after a material contract issue was identified.',
    ],
  };
  const [headline, confidence, reason] = descriptions[stage];
  if (!searching) plan.direction = { headline, confidence, reason };
  if (['BUNDLE', 'PITCHED', 'DISCOVERY', 'DONE'].includes(stage)) {
    plan.strategies = [
      {
        title: 'Explore staged payments',
        detail:
          'Example discussion point: ask which terms the seller would consider. No financing has been arranged.',
      },
    ];
  }
  if (stage === 'DISCOVERY') {
    plan.checklist = [
      { label: 'Review ownership records', answered: true },
      { label: 'Inspect operating procedures', answered: true },
      { label: 'Verify financial records', answered: false },
      { label: 'Review customer contracts', answered: false },
    ];
    plan.progress = { answered: 2, total: 4 };
  }
  if (stage === 'DONE') {
    plan.progress = { answered: 4, total: 4 };
    plan.findings = plan.findings.map((f) => ({
      ...f,
      status: 'positive',
      source: 'Completed fictional review',
    }));
  }
  if (stage === 'WALKED')
    plan.findings[3] = {
      category: 'Legal',
      text: 'Key contract cannot transfer',
      status: 'risk',
      source: 'Fictional evidence outcome',
    };
  const updates: PlanUpdate[] = searching
    ? [{ key: 'skills', label: 'Skills & experience', count: 2 }]
    : [
        {
          key: later ? 'Numbers' : 'Motivation',
          label: later ? 'Numbers' : 'Motivation',
          count: 1,
        },
      ];
  plan.unread = updates.reduce((n, u) => n + u.count, 0);
  const summary: Summary = {
    title: searching ? 'Your search so far' : `${stageLabel(stage)} · summary`,
    sections: [
      {
        heading: 'What we have',
        items: searching
          ? plan.buyBox.skills
          : [plan.title, `Example asking price: ${plan.askingPrice}`],
      },
      {
        heading: stage === 'DONE' || stage === 'WALKED' ? 'Outcome' : 'Next step',
        items: [reason],
      },
    ],
  };
  return {
    acquisition: plan,
    reply: {
      text: searching
        ? 'In this example, your experience points toward service businesses. Your search plan keeps that picture together as you explore.'
        : `In this example: ${reason}`,
      updates,
      summary,
    },
  };
}

export function startScenario(state: CoachState, stage: Stage): Conversation {
  const { acquisition, reply } = scenarioState(stage);
  const chat = startAcquisition(state, acquisition.entry, acquisition);
  chat.messages.push({
    id: uid(),
    role: 'assistant',
    text: reply.text,
    createdAt: chat.createdAt,
    updates: reply.updates,
    summary: reply.summary,
  });
  return chat;
}

export const summaryText = (summary: Summary) =>
  [
    summary.title,
    ...summary.sections.flatMap((s) => ['', s.heading, ...s.items.map((i) => `• ${i}`)]),
  ].join('\n');

// Persisted optional metadata is untrusted; a malformed plan never destroys chat history.
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown, limit = 2000) => (typeof v === 'string' ? v.slice(0, limit) : '');
const list = (v: unknown) => (Array.isArray(v) ? v.slice(-30) : []);
const strings = (v: unknown) =>
  list(v)
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.slice(0, 2000));
const count = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1000, Math.floor(v))) : 0;
export function cleanUpdates(value: unknown): PlanUpdate[] {
  return list(value).flatMap((item) => {
    const v = object(item),
      key = str(v.key) as PlanKey;
    return [...categories, ...Object.keys(buyBoxLabels), 'evidence'].includes(key)
      ? [
          {
            key,
            label:
              key === 'evidence'
                ? 'Evidence & Findings'
                : (buyBoxLabels[key as keyof typeof buyBoxLabels] ?? key),
            count: Math.max(1, count(v.count)),
          },
        ]
      : [];
  });
}
export function cleanSummary(value: unknown): Summary | undefined {
  const v = object(value);
  if (!str(v.title) || !Array.isArray(v.sections)) return;
  return {
    title: str(v.title, 160),
    sections: list(v.sections).map((s) => ({
      heading: str(object(s).heading, 160),
      items: strings(object(s).items),
    })),
  };
}
export function cleanAcquisition(value: unknown): Acquisition | undefined {
  const v = object(value);
  if (
    v.version !== 1 ||
    !['searching', 'has_target'].includes(String(v.entry)) ||
    ![...stages.map((s) => s[0]), 'DONE', 'WALKED'].includes(String(v.stage))
  )
    return;
  const result = emptyAcquisition(v.entry as Entry);
  result.stage = v.stage as Stage;
  result.example = v.example === true;
  result.title = str(v.title, 120) || result.title;
  result.location = str(v.location, 160);
  result.industry = str(v.industry, 160);
  result.askingPrice = str(v.askingPrice, 80);
  result.facts = list(v.facts)
    .map((f) => ({ label: str(object(f).label, 160), value: str(object(f).value) }))
    .filter((f) => f.value);
  for (const key of Object.keys(buyBoxLabels) as (keyof typeof buyBoxLabels)[])
    result.buyBox[key] = strings(object(v.buyBox)[key]);
  result.checklist = list(v.checklist).map((c) => ({
    label: str(object(c).label),
    answered: object(c).answered === true,
  }));
  result.findings = list(v.findings).flatMap((f) => {
    const item = object(f);
    return categories.includes(item.category as Finding['category']) &&
      ['positive', 'caution', 'risk', 'unknown'].includes(String(item.status))
      ? [
          {
            category: item.category as Finding['category'],
            text: str(item.text),
            status: item.status as Finding['status'],
            source: str(item.source),
          },
        ]
      : [];
  });
  const d = object(v.direction);
  result.direction = str(d.headline)
    ? { headline: str(d.headline, 160), confidence: str(d.confidence, 80), reason: str(d.reason) }
    : null;
  result.strategies = list(v.strategies).map((s) => ({
    title: str(object(s).title, 160),
    detail: str(object(s).detail),
  }));
  const p = object(v.progress),
    total = count(p.total);
  result.progress = { total, answered: Math.min(total, count(p.answered)) };
  result.unread = count(v.unread);
  return result;
}
