import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  View,
  findNodeHandle,
  type LayoutChangeEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/theme';
import { Card, Copy, Hit, TextAction } from '../home/ui';
import {
  buyBoxLabels,
  categories,
  stages,
  stageLabel,
  summaryText,
  type Acquisition,
  type Entry,
  type Finding,
  type PlanKey,
  type Summary,
} from './acquisition';

export function AaronAvatar({ large = false }: { large?: boolean }) {
  const size = large ? 64 : 32;
  return (
    <View
      accessible={false}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: theme.colors.controlBorder,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Copy size={large ? 30 : 16} style={{ fontWeight: '700' }}>
        A
      </Copy>
    </View>
  );
}

export function AcquisitionOpening({
  entry,
  pick,
}: {
  entry?: Entry;
  pick: (entry: Entry) => void;
}) {
  return (
    <View style={{ paddingTop: 28, paddingBottom: 32, gap: 24 }}>
      <AaronAvatar large />
      <View style={{ gap: 12 }}>
        <Copy caps size={12} muted>
          Build your next chapter
        </Copy>
        <Copy accessibilityRole="header" caps size={30} style={{ lineHeight: 36 }}>
          {!entry
            ? 'Where are you up to?'
            : entry === 'searching'
              ? 'Where do we start?'
              : 'What’s the deal?'}
        </Copy>
        <Copy size={16} muted>
          {!entry
            ? 'So Aaron starts in the right place.'
            : entry === 'searching'
              ? 'Tell me a bit about yourself and we’ll work out what suits you.'
              : 'Tell me about the business you’re looking at.'}
        </Copy>
      </View>
      {!entry && (
        <View style={{ gap: 12 }}>
          {(
            [
              [
                'searching',
                'I’m looking for a business',
                'No target yet. Let’s work out what suits you.',
              ],
              ['has_target', 'I’ve got one in mind', 'A specific business or listing.'],
            ] as const
          ).map(([value, label, hint]) => (
            <Hit
              key={value}
              accessibilityLabel={label}
              accessibilityHint={hint}
              onPress={() => pick(value)}
              style={{
                padding: 20,
                gap: 8,
                borderWidth: 1,
                borderColor: theme.colors.controlBorder,
                borderRadius: theme.radius.control,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Copy size={16}>{label}</Copy>
              <Copy muted size={13}>
                {hint}
              </Copy>
            </Hit>
          ))}
        </View>
      )}
    </View>
  );
}

export function SummaryCard({ summary }: { summary: Summary }) {
  const [notice, setNotice] = useState('');
  async function copy() {
    try {
      const copied = await Clipboard.setStringAsync(summaryText(summary));
      if (!copied) throw new Error('Clipboard unavailable');
      setNotice('Summary copied.');
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility('Summary copied.');
    } catch {
      setNotice('Couldn’t copy. You can select and copy the summary text below.');
      if (Platform.OS !== 'web')
        AccessibilityInfo.announceForAccessibility(
          'Couldn’t copy. Select and copy the summary text.',
        );
    }
  }
  return (
    <Card style={{ marginTop: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Copy caps size={12} accessibilityRole="header" style={{ flex: 1, minWidth: 120 }}>
          {summary.title}
        </Copy>
        <TextAction label="Copy summary" onPress={() => void copy()} />
      </View>
      {summary.sections.map((section, i) => (
        <View key={i} style={{ gap: 6 }}>
          <Copy size={13}>{section.heading}</Copy>
          {section.items.map((item, j) => (
            <Copy selectable key={j} size={13} muted>
              • {item}
            </Copy>
          ))}
        </View>
      ))}
      {!!notice && (
        <Copy size={12} role="status" accessibilityLiveRegion="polite">
          {notice}
        </Copy>
      )}
    </Card>
  );
}

export const statusLabels: Record<Finding['status'], string> = {
  positive: '✓ Positive',
  caution: '! Needs review',
  risk: '× Risk',
  unknown: '○ Not established',
};

export function Facts({ facts }: { facts: Acquisition['facts'] }) {
  return (
    <View style={{ gap: 16 }}>
      {facts.length ? (
        facts.map((fact, i) => (
          <View
            key={i}
            style={{
              gap: 4,
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
              paddingBottom: 12,
            }}
          >
            <Copy size={12} muted>
              {fact.label}
            </Copy>
            <Copy selectable>{fact.value}</Copy>
          </View>
        ))
      ) : (
        <Copy muted>No facts captured yet. Your notes will appear here as you talk.</Copy>
      )}
    </View>
  );
}

export type PlanFocus = { key: PlanKey; at: number };
export function AcquisitionPlan({
  plan,
  focus,
  scrollTo,
  onLayout,
}: {
  plan: Acquisition;
  focus: PlanFocus | null;
  scrollTo: (y: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const root = useRef<View>(null);
  const targets = useRef<Record<string, View | null>>({});
  const initial = ['buybox', 'checklist'];
  const [expanded, setExpanded] = useState<string[]>(initial);
  const focusSection =
    focus?.key === 'evidence'
      ? 'evidence'
      : categories.includes(focus?.key as (typeof categories)[number])
        ? 'health'
        : 'buybox';
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const target = targets.current[focus.key];
      if (!target || !root.current) return;
      target.measureLayout(
        root.current,
        (_x, y) => {
          scrollTo(y);
          if (Platform.OS === 'web')
            (target as unknown as HTMLElement).focus?.({ preventScroll: true });
          else {
            const handle = findNodeHandle(target);
            if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
          }
        },
        () => {},
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, scrollTo]);
  const opened = (key: string) =>
    expanded.includes(key) || (!!focus && (key === focusSection || key === focus.key));
  // A focus token opens the requested area initially; a tap can subsequently close it.
  const [dismissedFocus, setDismissedFocus] = useState<string[]>([]);
  const isOpen = (key: string) => opened(key) && !dismissedFocus.includes(`${focus?.at}:${key}`);
  function toggle(key: string) {
    if (isOpen(key)) {
      setExpanded((s) => s.filter((k) => k !== key));
      setDismissedFocus((s) => [...s, `${focus?.at}:${key}`]);
    } else {
      setExpanded((s) => [...s, key]);
      setDismissedFocus((s) => s.filter((k) => k !== `${focus?.at}:${key}`));
    }
  }
  function section(key: string, title: string, children: ReactNode, count?: string) {
    return (
      <View
        key={key}
        style={{ borderTopWidth: 1, borderColor: theme.colors.border, paddingVertical: 8 }}
      >
        <Hit
          controlRef={(v) => {
            targets.current[key] = v;
          }}
          accessibilityState={{ expanded: isOpen(key) }}
          accessibilityLabel={title}
          onPress={() => toggle(key)}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}
        >
          <Copy caps size={12} style={{ flex: 1 }}>
            {title}
          </Copy>
          {!!count && (
            <Copy size={12} muted>
              {count}
            </Copy>
          )}
          <Copy size={20} accessible={false} aria-hidden>
            {isOpen(key) ? '−' : '+'}
          </Copy>
        </Hit>
        {isOpen(key) && <View style={{ gap: 12, paddingBottom: 16 }}>{children}</View>}
      </View>
    );
  }
  const searching = plan.stage === 'SCOUTING';
  const idx = stages.findIndex(([key]) => key === plan.stage);
  const risks = plan.findings.filter((f) => f.status === 'risk' || f.status === 'caution');
  return (
    <View
      ref={root}
      onLayout={onLayout}
      testID="acquisition-plan"
      style={{ paddingTop: 24, gap: 16 }}
    >
      <View style={{ gap: 8 }}>
        <Copy caps size={11} muted>
          {searching ? 'Your search' : 'Your deal plan'}
        </Copy>
        <Copy size={24} accessibilityRole="header" style={{ fontWeight: '700' }}>
          {plan.title}
        </Copy>
        <Copy muted>
          {plan.location || (searching ? 'Location open' : 'Location not established')}
        </Copy>
        {searching && <Copy muted>{plan.industry || 'Target industry not established'}</Copy>}
        {plan.example && (
          <Copy size={12} muted>
            Example scenario · fictional details
          </Copy>
        )}
      </View>
      <View
        style={{ gap: 10, paddingVertical: 12 }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Acquisition journey"
        aria-valuemin={0}
        aria-valuemax={stages.length}
        aria-valuenow={plan.stage === 'DONE' ? stages.length : Math.max(0, idx)}
        aria-valuetext={
          plan.stage === 'WALKED'
            ? 'Walked away. This deal is closed.'
            : `${stageLabel(plan.stage)}. ${plan.progress.answered} of ${plan.progress.total} checks answered in this stage.`
        }
        accessibilityValue={{
          min: 0,
          max: stages.length,
          now: plan.stage === 'DONE' ? stages.length : Math.max(0, idx),
          text:
            plan.stage === 'WALKED'
              ? 'Walked away. This deal is closed.'
              : `${stageLabel(plan.stage)}. ${plan.progress.answered} of ${plan.progress.total} checks answered in this stage.`,
        }}
      >
        <Copy size={13}>
          {idx >= 0 ? `Stage ${idx + 1} of ${stages.length} · ` : ''}
          {stageLabel(plan.stage)}
        </Copy>
        <View style={{ flexDirection: 'row', gap: 4 }} aria-hidden>
          {stages.map(([key], i) => (
            <View key={key} style={{ flex: 1, height: 4, backgroundColor: theme.colors.border }}>
              <View
                style={{
                  height: 4,
                  width:
                    plan.stage === 'DONE' || i < idx
                      ? '100%'
                      : i === idx
                        ? `${plan.progress.total ? (plan.progress.answered / plan.progress.total) * 100 : 0}%`
                        : '0%',
                  backgroundColor: i === idx ? theme.colors.muted : theme.colors.accent,
                }}
              />
            </View>
          ))}
        </View>
        {plan.stage !== 'WALKED' && (
          <Copy size={12} muted>
            {plan.progress.answered} of {plan.progress.total} checks answered in this stage
          </Copy>
        )}
      </View>
      {!searching && (
        <View style={{ gap: 4 }}>
          <Copy caps size={11} muted>
            Asking price
          </Copy>
          <Copy size={26} style={plan.askingPrice ? { fontFamily: theme.fontNumbers } : undefined}>
            {plan.askingPrice || 'Not established'}
          </Copy>
        </View>
      )}
      {plan.stage === 'WALKED' && (
        <Card>
          <Copy>× This example is closed</Copy>
          <Copy muted>
            The recorded reason remains available below. Start a new conversation to explore another
            business.
          </Copy>
        </Card>
      )}
      {searching ? (
        section(
          'buybox',
          'Your Buy Box',
          <>
            <Copy muted>What you’re looking for</Copy>
            {(Object.entries(buyBoxLabels) as [keyof typeof buyBoxLabels, string][]).map(
              ([key, label]) => (
                <View key={key}>
                  <Hit
                    controlRef={(v) => {
                      targets.current[key] = v;
                    }}
                    onPress={() => toggle(key)}
                    accessibilityLabel={label}
                    accessibilityState={{ expanded: isOpen(key) }}
                    style={{
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Copy style={{ flex: 1 }}>{label}</Copy>
                    <Copy muted size={12}>
                      {plan.buyBox[key].length || '—'}
                    </Copy>
                    <Copy accessible={false} aria-hidden>
                      {isOpen(key) ? '−' : '+'}
                    </Copy>
                  </Hit>
                  {isOpen(key) && (
                    <View style={{ gap: 8, paddingBottom: 12 }}>
                      {plan.buyBox[key].length ? (
                        plan.buyBox[key].map((text, i) => (
                          <Copy key={i} muted>
                            • {text}
                          </Copy>
                        ))
                      ) : (
                        <Copy muted>Not established yet.</Copy>
                      )}
                    </View>
                  )}
                </View>
              ),
            )}
          </>,
        )
      ) : (
        <>
          {['PRE_MEET', 'DISCOVERY'].includes(plan.stage) &&
            section(
              'checklist',
              plan.stage === 'PRE_MEET' ? 'Before the meeting' : 'Due diligence checklist',
              <>
                {plan.checklist.map((item, i) => (
                  <Copy key={i}>
                    {item.answered ? '✓' : '○'} {item.label}
                    <Copy size={12} muted>
                      {item.answered ? ' · Answered' : ' · Outstanding'}
                    </Copy>
                  </Copy>
                ))}
              </>,
            )}
          <Card style={{ gap: 12 }}>
            <Copy caps size={11} muted>
              Deal direction
            </Copy>
            <Copy size={24} accessibilityRole="header">
              {plan.direction?.headline || 'Keep gathering'}
            </Copy>
            <Copy size={12}>
              Confidence · {plan.direction?.confidence || 'Insufficient information'}
            </Copy>
            <Copy muted>
              {plan.direction?.reason ||
                'Describe the business and what you know so far. There is no assessment yet.'}
            </Copy>
          </Card>
          {section(
            'strategies',
            'Suggested Deal Strategies',
            plan.strategies.length ? (
              plan.strategies.map((s, i) => (
                <View key={i} style={{ gap: 6 }}>
                  <Copy>{s.title}</Copy>
                  <Copy muted>{s.detail}</Copy>
                </View>
              ))
            ) : (
              <Copy muted>
                Strategies will appear when there is enough context to explore the structure.
              </Copy>
            ),
          )}
          {section(
            'risks',
            'Critical Risks',
            risks.length ? (
              risks.map((f, i) => <FindingRow key={i} finding={f} />)
            ) : (
              <Copy muted>
                No risks established yet. This does not mean the deal has been checked.
              </Copy>
            ),
            String(risks.length),
          )}
          {section(
            'health',
            'Deal Health',
            <>
              {categories.map((category) => {
                const findings = plan.findings.filter((f) => f.category === category);
                return (
                  <View key={category}>
                    <Hit
                      controlRef={(v) => {
                        targets.current[category] = v;
                      }}
                      accessibilityLabel={category}
                      accessibilityState={{ expanded: isOpen(category) }}
                      onPress={() => toggle(category)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <Copy style={{ flex: 1 }}>{category}</Copy>
                      <Copy size={12} muted>
                        {findings.filter((f) => f.status !== 'unknown').length}/{findings.length}
                      </Copy>
                      <Copy accessible={false} aria-hidden>
                        {isOpen(category) ? '−' : '+'}
                      </Copy>
                    </Hit>
                    {isOpen(category) && (
                      <View style={{ gap: 16, paddingBottom: 16 }}>
                        {findings.length ? (
                          findings.map((f, i) => <FindingRow key={i} finding={f} />)
                        ) : (
                          <Copy muted>No findings established.</Copy>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>,
          )}
        </>
      )}
      {section(
        'evidence',
        'Evidence & Findings',
        <Facts facts={plan.facts} />,
        String(plan.facts.length),
      )}
    </View>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <View
      style={{
        gap: 6,
        borderLeftWidth: 2,
        borderColor: theme.colors.controlBorder,
        paddingLeft: 12,
      }}
    >
      <Copy size={12}>{statusLabels[finding.status]}</Copy>
      <Copy>{finding.text}</Copy>
      <Copy size={12} muted>
        {finding.source}
      </Copy>
    </View>
  );
}
